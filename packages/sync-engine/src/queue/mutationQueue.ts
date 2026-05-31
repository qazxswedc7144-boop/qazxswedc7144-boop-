// packages/sync-engine/src/queue/mutationQueue.ts
import { db } from "@/core/db";

export interface Mutation {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  retryCount: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  idempotencyKey: string;
  status: "PENDING" | "PROCESSING" | "FAILED" | "COMPLETED";
  error?: string;
  lastAttemptAt?: number;
}

export class MutationQueue {
  private static instance: MutationQueue;

  private constructor() {}

  public static getInstance(): MutationQueue {
    if (!MutationQueue.instance) {
      MutationQueue.instance = new MutationQueue();
    }
    return MutationQueue.instance;
  }

  /**
   * Enqueue a mutation locally. It saves directly to Dexie database 'sync_queue'.
   */
  public async enqueue(mutation: Omit<Mutation, "id" | "timestamp" | "retryCount" | "status">): Promise<Mutation> {
    const id = db.generateId("MUT");
    const fullMutation: Mutation = {
      ...mutation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      status: "PENDING"
    };

    await db.sync_queue.add(fullMutation);
    
    // Log sync operation for tracing
    await db.sync_logs.add({
      id: db.generateId("SLOG"),
      timestamp: Date.now(),
      mutationId: id,
      idempotencyKey: mutation.idempotencyKey,
      status: "PENDING",
      details: `Enqueued mutation of type ${mutation.type}`
    });

    return fullMutation;
  }

  /**
   * Fetch all pending mutations sorted by priority and timestamp
   */
  public async getPendingMutations(): Promise<Mutation[]> {
    const all = await db.sync_queue.where("status").equals("PENDING").toArray();
    return this.sortMutations(all);
  }

  /**
   * Fetch failed mutations indicating they are waiting for retry / reconnect
   */
  public async getFailedMutations(): Promise<Mutation[]> {
    const all = await db.sync_queue.where("status").equals("FAILED").toArray();
    return this.sortMutations(all);
  }

  /**
   * Sort mutations by priority (CRITICAL -> HIGH -> MEDIUM -> LOW) and then timestamp
   */
  private sortMutations(mutations: Mutation[]): Mutation[] {
    const priorityWeights = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1
    };

    return [...mutations].sort((a, b) => {
      const weightA = priorityWeights[a.priority] || 1;
      const weightB = priorityWeights[b.priority] || 1;
      
      if (weightA !== weightB) {
        return weightB - weightA; // Higher weight first
      }
      return a.timestamp - b.timestamp; // Older first
    });
  }

  /**
   * Update mutation status atomically
   */
  public async updateStatus(
    id: string, 
    status: Mutation["status"], 
    error?: string
  ): Promise<void> {
    const updatePayload: Partial<Mutation> = { status, lastAttemptAt: Date.now() };
    if (error !== undefined) {
      updatePayload.error = error;
    }
    
    await db.sync_queue.update(id, updatePayload);

    // If completed or failed, we log it
    await db.sync_logs.add({
      id: db.generateId("SLOG"),
      timestamp: Date.now(),
      mutationId: id,
      status,
      details: error ? `Error: ${error}` : `Mutation processed successfully`
    });

    if (status === "FAILED") {
      await db.sync_failures.add({
        id: db.generateId("SFAIL"),
        mutationId: id,
        timestamp: Date.now(),
        error: error || "Unknown Error"
      });
    }
  }

  /**
   * Increment retry count and reset to PENDING if under max retries
   */
  public async incrementRetry(id: string, error: string, maxRetries = 5): Promise<boolean> {
    const mutation = await db.sync_queue.get(id);
    if (!mutation) return false;

    const newCount = mutation.retryCount + 1;
    if (newCount >= maxRetries) {
      await this.updateStatus(id, "FAILED", `Exceeded max retries of ${maxRetries}. Error: ${error}`);
      return false; // Permanently failed
    } else {
      await db.sync_queue.update(id, {
        retryCount: newCount,
        status: "PENDING",
        error,
        lastAttemptAt: Date.now()
      });
      return true; // Still retrying
    }
  }

  /**
   * Clear processed items from the queue to free space
   */
  public async compactQueue(): Promise<number> {
    const completed = await db.sync_queue.where("status").equals("COMPLETED").toArray();
    const ids = completed.map(m => m.id);
    if (ids.length > 0) {
      await db.sync_queue.bulkDelete(ids);
    }
    return ids.length;
  }
}
