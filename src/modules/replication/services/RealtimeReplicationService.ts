// src/modules/replication/services/RealtimeReplicationService.ts

import { db } from "@/core/db";
import { BranchService } from "@/modules/branches/services/BranchService";
import { rtdb } from "@/config/firebase";
import { ref, onChildAdded, onValue, off, DatabaseReference } from "firebase/database";
import { SyncEngine } from "@/modules/sync/SyncEngine";

export type ClientReplicationEventHandler = (event: Record<string, unknown>) => void;

class RealtimeReplicationService {
  private static handlers: Set<ClientReplicationEventHandler> = new Set();
  private static activeBranchId: string = "BRH-MAIN-001";
  private static isServiceEventBound = false;
  private static replicationRef: DatabaseReference | null = null;
  private static connectedRef: DatabaseReference | null = null;
  private static unsubscribeFn: (() => void) | null = null;
  private static unloadListener: (() => void) | null = null;

  static subscribe(handler: ClientReplicationEventHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  static connect(branchId: string = "BRH-MAIN-001") {
    this.activeBranchId = branchId;

    if (!this.isServiceEventBound) {
      this.isServiceEventBound = true;
      SyncEngine.init(); // Initialize Event-Driven Sync Engine
      
      // Auto-cleanup on unload
      if (typeof window !== 'undefined' && !this.unloadListener) {
        this.unloadListener = () => this.disconnect();
        window.addEventListener('beforeunload', this.unloadListener);
      }
    }

    if (this.replicationRef) {
      this.disconnect();
    }

    console.log(`[REPLICATION_CLIENT] Connecting Firebase RTDB on branch: ${branchId}...`);

    try {
      this.replicationRef = ref(rtdb, `replication_events/${branchId}`);
      this.connectedRef = ref(rtdb, ".info/connected");
      
      const lastSeq = parseInt(localStorage.getItem("pharma_last_sequence") || "0", 10);
      
      // Listen to Firebase Connection State
      onValue(this.connectedRef, (snap) => {
        if (snap.val() === true) {
          console.log("✅ [REPLICATION_CLIENT] Connected to Firebase! Draining queue...");
          SyncEngine.drainQueue();
        } else {
          console.log("⚠️ [REPLICATION_CLIENT] Disconnected from Firebase.");
        }
      });

      // Handle remote incoming events
      this.unsubscribeFn = onChildAdded(this.replicationRef, (snapshot) => {
        const event = snapshot.val();
        if (event && event.type) {
           if (event.sequence && event.sequence <= lastSeq) return;
           this.handleIncomingReplicationEvent(event).catch((e: unknown) => {
             console.error("[REPLICATION_CLIENT] Event processing failed:", e);
           });
        }
      });

    } catch (err: unknown) {
      console.error("[REPLICATION_CLIENT] Failed to bind realtime listeners:", (err as Error).message);
    }
  }

  static disconnect() {
    if (this.replicationRef && this.unsubscribeFn) {
      this.unsubscribeFn(); 
      off(this.replicationRef);
      this.replicationRef = null;
      this.unsubscribeFn = null;
    }
    if (this.connectedRef) {
      off(this.connectedRef);
      this.connectedRef = null;
    }
    console.log("[REPLICATION_CLIENT] Realtime replication explicit disconnect.");
  }

  /**
   * Delegates event syncing to the unified Outbox SyncEngine
   */
  static async enqueueSyncEvent(type: string, payload: Record<string, unknown>, entityType: string = 'generic'): Promise<void> {
    await SyncEngine.enqueue(type, payload, entityType);
  }

  /**
   * Processes incoming data with strict conflict resolution & Dexie Transactions
   */
  private static async handleIncomingReplicationEvent(rawEvent: Record<string, unknown>): Promise<void> {
    const event = rawEvent as any;
    if (!event || (!event.mutationId && !event.id)) return;
    
    const eventId = event.mutationId || event.id;

    try {
      console.log(`🎯 [REPLICATION_CLIENT] Replicating locally: ${event.type} (#Seq: ${event.sequence})`);

      const currentSeq = event.sequence || 0;
      const lastSeq = parseInt(localStorage.getItem("pharma_last_sequence") || "0", 10);
      if (currentSeq > lastSeq) {
        localStorage.setItem("pharma_last_sequence", currentSeq.toString());
      }

      const { type, payload } = event;

      try {
        switch (type) {
          case "InventoryUpdated":
            if (payload.productId && payload.qty) {
              await db.transaction('rw', db.branchInventory, async () => {
                await BranchService.updateBranchStock(payload.branchId || this.activeBranchId, payload.productId, payload.qty);
              });
            }
            break;

          case "TransferCreated":
            if (payload.transfer && payload.items) {
              await db.transaction('rw', db.branchTransfers, db.branchTransferItems, async () => {
                const checkTransfer = await db.branchTransfers.get(payload.transfer.id);
                if (!checkTransfer) {
                  await db.branchTransfers.add(payload.transfer);
                  await db.branchTransferItems.bulkAdd(payload.items);
                }
              });
            }
            break;

          case "TransferShipped":
          case "TransferReceived":
             break;

          case "SaleCreated": {
            await db.transaction('rw', db.sales, db.syncLogs, db.products, async () => {
              const existing = await db.sales.get(payload.id);
              // Conflict Resolution: Version Number priority
              const incomingVersion = payload.version || 1;
              const localVersion = existing ? (existing.version || 0) : 0;
              
              if (!existing || incomingVersion > localVersion) {
                 await db.sales.put({ ...payload, version: incomingVersion });
                 
                 // Deduct stock if new
                 if (!existing && payload.items) {
                   for (const item of payload.items) {
                     const p = await db.products.get(item.productId);
                     if (p && p.stock >= item.qty) {
                       await db.products.update(item.productId, { stock: p.stock - item.qty });
                     }
                   }
                 }
                 
                 await db.syncLogs.add({ action: 'CONFLICT_RESOLVED', details: 'Applied remote Sale', mutationId: eventId, timestamp: new Date().toISOString() });
              } else {
                 await db.syncLogs.add({ action: 'DUPLICATE_DETECTED', details: 'Ignored older Sale', mutationId: eventId, timestamp: new Date().toISOString() });
              }
            });
            break;
          }

          case "PurchaseCreated": {
            await db.transaction('rw', db.purchases, db.syncLogs, db.products, async () => {
              const existing = await db.purchases.get(payload.id);
              const incomingVersion = payload.version || 1;
              const localVersion = existing ? (existing.version || 0) : 0;
              
              if (!existing || incomingVersion > localVersion) {
                 await db.purchases.put({ ...payload, version: incomingVersion });
                 
                 // Add stock if new
                 if (!existing && payload.items) {
                   for (const item of payload.items) {
                     const p = await db.products.get(item.productId);
                     if (p) {
                       await db.products.update(item.productId, { stock: p.stock + item.qty });
                     }
                   }
                 }
                 
                 await db.syncLogs.add({ action: 'CONFLICT_RESOLVED', details: 'Applied remote Purchase', mutationId: eventId, timestamp: new Date().toISOString() });
              } else {
                 await db.syncLogs.add({ action: 'DUPLICATE_DETECTED', details: 'Ignored older Purchase', mutationId: eventId, timestamp: new Date().toISOString() });
              }
            });
            break;
          }
        }
      } catch (mutErr: unknown) {
        console.warn(`[REPLICATION_CLIENT] Local Dexie persistence error on event ${type}:`, (mutErr as Error).message);
      }

      // Dispatch to UI
      this.handlers.forEach((handler) => {
        try { handler(event); } catch (err) { /* ignore ui errors */ }
      });
    } catch (err: unknown) {
      console.error("[REPLICATION_CLIENT] Event processing error:", err);
    }
  }
}

export { RealtimeReplicationService };
export default RealtimeReplicationService;

