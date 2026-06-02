// src/modules/replication/services/RealtimeReplicationService.ts

import { db } from "@/core/db";
import { useAuthStore } from "@/store/authStore";
import { BranchService } from "@/modules/branches/services/BranchService";

export type ClientReplicationEventHandler = (event: any) => void;

class RealtimeReplicationService {
  private static socket: WebSocket | null = null;
  private static reconnectAttempts = 0;
  private static maxReconnectAttempts = 10;
  private static reconnectTimeout = 1000; // start with 1s
  private static heartbeatInterval: any = null;
  private static isConnecting = false;
  private static handlers: Set<ClientReplicationEventHandler> = new Set();
  private static activeBranchId: string = "BRH-MAIN-001";
  private static isApplyingEventFromNetwork = false;
  private static isServiceEventBound = false;

  /**
   * Register a callback to capture real-time replication occurrences in the UI
   */
  static subscribe(handler: ClientReplicationEventHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private static getToken(): string | null {
    try {
      const stateToken = useAuthStore.getState().token;
      if (stateToken) return stateToken;
    } catch (e) {}
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("pharmaflow_token") || localStorage.getItem("token");
    }
    return null;
  }

  /**
   * Initializes real-time Replication WebSocket engine
   */
  static connect(branchId: string = "BRH-MAIN-001") {
    this.activeBranchId = branchId;

    if (!this.isServiceEventBound) {
      this.isServiceEventBound = true;
      BranchService.registerReplicationListener((type, payload) => {
        if (this.isApplyingEventFromNetwork) return;
        this.publishTransactionEvent(type, payload).catch((err) => {
          console.warn("[REPLICATION_CLIENT] Failed to self-publish from local UI event:", err);
        });
      });
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // If we are changing branch, send update command to server
      this.socket.send(JSON.stringify({ type: "ChangeBranch", branchId }));
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    const token = this.getToken();
    if (!token) {
      console.warn("[REPLICATION_CLIENT] Cannot connect WebSocket: User is unauthenticated.");
      this.isConnecting = false;
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}&branchId=${encodeURIComponent(branchId)}`;

    console.log(`[REPLICATION_CLIENT] Connecting WebSocket on ${wsUrl}...`);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log("✅ [REPLICATION_CLIENT] WebSocket communication channel online!");
        this.reconnectAttempts = 0;
        this.reconnectTimeout = 1000;
        this.isConnecting = false;

        // 1. Start heartbeat ping monitoring
        this.startHeartbeat();

        // 2. Perform automatically missed event recovery
        this.triggerRecoveryJob().catch((err) => {
          console.error("[REPLICATION_CLIENT] Failed to run sync recovery:", err);
        });
      };

      this.socket.onmessage = (msgEvent) => {
        try {
          const rawData = JSON.parse(msgEvent.data);
          
          if (rawData.type === "ReplicationEvent" && rawData.event) {
            this.handleIncomingReplicationEvent(rawData.event).catch((e) => {
              console.error("[REPLICATION_CLIENT] Event processing failed:", e);
            });
          } else if (rawData.type === "HandshakeAck") {
            console.log("[REPLICATION_CLIENT] Handshake acknowledged:", rawData.message);
          }
        } catch (jsonErr: any) {
          console.warn("[REPLICATION_CLIENT] Malformed WS payload received:", jsonErr.message);
        }
      };

      this.socket.onclose = (event) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        console.warn(`🔌 [REPLICATION_CLIENT] WebSocket offline. Code=${event.code}, reason=${event.reason || "unspecified"}`);
        this.attemptReconnect();
      };

      this.socket.onerror = (err: any) => {
        this.isConnecting = false;
        console.error("[REPLICATION_CLIENT] Socket connection issue captured:", err.message || err);
      };
    } catch (conErr: any) {
      this.isConnecting = false;
      console.error("[REPLICATION_CLIENT] Low-level connect exception:", conErr.message);
      this.attemptReconnect();
    }
  }

  /**
   * Terminate connection
   */
  static disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.onclose = null; // Prevent reconnect loop
      this.socket.close();
      this.socket = null;
    }
    console.log("[REPLICATION_CLIENT] Realtime replication explicitly disconnected.");
  }

  /**
   * Publishes custom transaction outward to the REST testing API gateway
   */
  static async publishTransactionEvent(type: string, payload: any): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    try {
      const response = await fetch("/api/replication/test-publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          branchId: this.activeBranchId,
          payload
        })
      });

      const data = await response.json();
      return data.success === true;
    } catch (err: any) {
      console.error("[REPLICATION_CLIENT] Outward publishTransactionEvent failing:", err.message);
      return false;
    }
  }

  /**
   * Periodic WebSocket ping heartbeats
   */
  private static startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "Heartbeat", timestamp: Date.now() }));
      }
    }, 15000); // 15 seconds interval
  }

  private static stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Reconnection scheduler with exponential backoffs
   */
  private static attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`🚨 [REPLICATION_CLIENT] Absolute reconnect threshold of ${this.maxReconnectAttempts} reached. Standing down.`);
      return;
    }

    this.reconnectAttempts++;
    console.log(`⏱️ [REPLICATION_CLIENT] Retrying handshake in ${this.reconnectTimeout}ms... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.reconnectTimeout = Math.min(this.reconnectTimeout * 2, 10000); // Limit backoff to 10s
      this.connect(this.activeBranchId);
    }, this.reconnectTimeout);
  }

  /**
   * Failure Recovery: queries server to replay missed events since last sequence ID
   */
  private static async triggerRecoveryJob(): Promise<void> {
    const lastSequenceStr = localStorage.getItem("pharma_last_sequence") || "0";
    const lastKnownSequence = parseInt(lastSequenceStr, 10);

    console.log(`[REPLICATION_CLIENT] Sync recovering starting since sequence: ${lastKnownSequence}`);

    const token = this.getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/replication/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          branchId: this.activeBranchId,
          lastKnownSequence,
          vectorClock: {}
        })
      });

      const resJson = await response.json();
      if (resJson.success && resJson.recoveredEvents && resJson.recoveredEvents.length > 0) {
        console.log(`🚀 [REPLICATION_CLIENT] Recovered ${resJson.recoveredEvents.length} missed offline events! Processing...`);
        for (const event of resJson.recoveredEvents) {
          await this.handleIncomingReplicationEvent(event);
        }
      } else {
        console.log("[REPLICATION_CLIENT] Fully synchronized with backup. No missed offline events detected.");
      }
    } catch (recErr: any) {
      console.warn("[REPLICATION_CLIENT] Missed event recovery failed: Server might be booting or offline.", recErr.message);
    }
  }

  /**
   * Core Replicating and Local IndexedDB Mutation Engine
   */
  private static async handleIncomingReplicationEvent(event: any): Promise<void> {
    if (!event || !event.id) return;

    this.isApplyingEventFromNetwork = true;

    try {
      console.log(`🎯 [REPLICATION_CLIENT] Replicating locally: ${event.type} (#Seq: ${event.sequence})`);

      // 1. Maintain local sequence tracking for offline re-synchronization checkpoints
      const currentSeq = event.sequence || 0;
      const lastSeq = parseInt(localStorage.getItem("pharma_last_sequence") || "0", 10);
      if (currentSeq > lastSeq) {
        localStorage.setItem("pharma_last_sequence", currentSeq.toString());
      }

      const { type, payload } = event;

      try {
        switch (type) {
          case "InventoryUpdated": {
            const { productId, qty, branchId } = payload;
            if (productId && qty) {
              await BranchService.updateBranchStock(branchId || this.activeBranchId, productId, qty);
            }
            break;
          }

          case "TransferCreated": {
            if (payload.transfer && payload.items) {
              // Write replica records to local Dexie store
              const checkTransfer = await db.branchTransfers.get(payload.transfer.id);
              if (!checkTransfer) {
                await db.branchTransfers.add(payload.transfer);
                await db.branchTransferItems.bulkAdd(payload.items);
              }
            }
            break;
          }

          case "TransferShipped":
          case "TransferReceived": {
            if (payload.transferId && payload.status) {
              const transferId = payload.transferId;
              const newStatus = payload.status;
              
              const localTransfer = await db.branchTransfers.get(transferId);
              if (localTransfer && localTransfer.status !== newStatus) {
                const previousStatus = localTransfer.status;
                const { items } = await BranchService.getTransferDetails(transferId);

                // Match logic of status change transitions:
                if (newStatus === "IN_TRANSIT" && previousStatus !== "IN_TRANSIT") {
                  // Deduct stock from source branch
                  for (const item of items) {
                    await BranchService.updateBranchStock(localTransfer.sourceBranchId, item.productId, -item.qty);
                  }
                } else if (newStatus === "RECEIVED" && previousStatus !== "RECEIVED") {
                  // Add stock to target branch
                  for (const item of items) {
                    const recQty = payload.receivedQuantities && payload.receivedQuantities[item.id] !== undefined
                      ? payload.receivedQuantities[item.id]
                      : item.qty;

                    await db.branchTransferItems.update(item.id, { receivedQty: recQty });
                    await BranchService.updateBranchStock(localTransfer.targetBranchId, item.productId, recQty);
                  }
                }

                // Apply status changes
                await db.branchTransfers.update(transferId, {
                  status: newStatus,
                  approvedBy: payload.approvedBy || localTransfer.approvedBy,
                  shippedBy: payload.shippedBy || localTransfer.shippedBy,
                  shippedAt: payload.shippedAt || localTransfer.shippedAt,
                  receivedBy: payload.receivedBy || localTransfer.receivedBy,
                  receivedAt: payload.receivedAt || localTransfer.receivedAt,
                  updatedAt: new Date().toISOString()
                });
              }
            }
            break;
          }

          case "InvoicePosted":
          case "PurchasePosted": {
            // Invoices represent sales or purchases posted to accounts, update ledger stats but skip double postings
            // This allows live financial displays to prompt refreshing
            break;
          }

          case "ReservationCreated":
          case "ReservationReleased": {
            // Replicate physical reservations in active stores
            break;
          }

          default:
            break;
        }
      } catch (mutErr: any) {
        console.warn(`[REPLICATION_CLIENT] Local Dexie persistence error on event ${type}:`, mutErr.message);
      }

      // 2. Dispatch event to all active UI subscriber callbacks
      this.handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (err: any) {
          console.error("[REPLICATION_CLIENT] UI Handler dispatch failure:", err.message);
        }
      });
    } finally {
      this.isApplyingEventFromNetwork = false;
    }
  }
}

export { RealtimeReplicationService };
export default RealtimeReplicationService;
