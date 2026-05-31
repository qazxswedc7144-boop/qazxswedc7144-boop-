// packages/sync-engine/src/workers/sync.worker.ts
import { MutationQueue, Mutation } from "../queue/mutationQueue";
import { HttpTransport } from "../transport/httpTransport";
import { NetworkMonitor } from "../monitoring/networkMonitor";

export class SyncWorker {
  private static instance: SyncWorker;
  private isProcessing = false;
  private isPaused = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private queue = MutationQueue.getInstance();
  private network = NetworkMonitor.getInstance();

  private constructor() {
    this.setupTriggers();
  }

  public static getInstance(): SyncWorker {
    if (!SyncWorker.instance) {
      SyncWorker.instance = new SyncWorker();
    }
    return SyncWorker.instance;
  }

  /**
   * Safe registration of automatic sync triggers (reconnect and window visibility change)
   */
  private setupTriggers() {
    if (typeof window === "undefined") return;

    // Trigger sync when reconnecting
    this.network.subscribe((state) => {
      if (state.status === "ONLINE" && !this.isPaused) {
        this.triggerSync();
      }
    });

    // Trigger sync when window becomes active again (Tab visible)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !this.isPaused) {
        this.triggerSync();
      }
    });
  }

  /**
   * Starts periodic polling worker
   */
  public start(intervalMs = 45000) {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      if (!this.isPaused) {
        this.triggerSync();
      }
    }, intervalMs);

    // Initial run
    this.triggerSync();
  }

  /**
   * Stops periodic sync checks
   */
  public stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    this.isPaused = false;
    this.triggerSync();
  }

  /**
   * Trigger the mutation processor in the background. Yields thread cleanly.
   */
  public triggerSync() {
    if (this.isProcessing || this.isPaused) return;

    // Use setTimeout to throw execution onto event queue, preventing main thread UI lag
    setTimeout(() => {
      this.processQueue().catch((err) => {
        console.error("[SyncWorker] Background sync queue processor crash:", err);
      });
    }, 50);
  }

  /**
   * Core processing loop of the mutation queue
   */
  private async processQueue() {
    const networkState = this.network.getSnapshot();
    if (networkState.status === "OFFLINE") {
      return; // Offline, can't push mutations
    }

    this.isProcessing = true;

    try {
      const pending = await this.queue.getPendingMutations();
      if (pending.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.info(`[SyncWorker] Syncing ${pending.length} pending mutations in micro-batches...`);

      // Chunk processing to guarantee main thread never starves
      const batchSize = 10;
      for (let i = 0; i < pending.length; i += batchSize) {
        if (this.isPaused) break;
        
        const batch = pending.slice(i, i + batchSize);
        await this.syncBatch(batch);

        // Yield execution to make sure thread doesn't lock
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Compact queue to free database size
      const deletedAmount = await this.queue.compactQueue();
      if (deletedAmount > 0) {
        console.info(`[SyncWorker] Coalesced and compacted ${deletedAmount} completed mutations from local database stores.`);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Pushes a specific mutation list to the backend sync service.
   */
  private async syncBatch(mutations: Mutation[]): Promise<void> {
    const payload = mutations.map(m => ({
      id: m.id,
      type: m.type,
      payload: m.payload,
      timestamp: m.timestamp,
      retryCount: m.retryCount,
      priority: m.priority,
      idempotencyKey: m.idempotencyKey
    }));

    try {
      // Set status to processing
      for (const m of mutations) {
        await this.queue.updateStatus(m.id, "PROCESSING");
      }

      // Safe push over HttpTransport with automatic token tracking
      const result = await HttpTransport.request<{ 
        success: boolean; 
        processed: string[]; 
        conflicts: any[]; 
        failures: any[] 
      }>("/api/v1/sync/push", {
        method: "POST",
        body: JSON.stringify({ mutations: payload })
      });

      if (result.success) {
        const processedSet = new Set(result.processed || []);
        
        for (const m of mutations) {
          if (processedSet.has(m.id)) {
            await this.queue.updateStatus(m.id, "COMPLETED");
          } else {
            // Find if there is a failure message
            const failure = result.failures?.find(f => f.mutationId === m.id);
            if (failure) {
              await this.queue.incrementRetry(m.id, failure.message);
            } else {
              await this.queue.incrementRetry(m.id, "Rejected by server sync manager");
            }
          }
        }
      } else {
        throw new Error("Server rejected batch upload");
      }
    } catch (error: any) {
      console.warn("[SyncWorker] Failed syncing mutations batch. Reverting status to pending for retry:", error);
      
      // Reset mutations to FAILED/PENDING with retries counter incremented
      for (const m of mutations) {
        await this.queue.incrementRetry(m.id, error.message || "Network Error");
      }
    }
  }
}
