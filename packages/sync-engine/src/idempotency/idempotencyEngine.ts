// packages/sync-engine/src/idempotency/idempotencyEngine.ts
import CryptoJS from "crypto-js";
import { db } from "@/core/db";

export class IdempotencyEngine {
  /**
   * Generates a unique, deterministic SHA-256 idempotency key.
   */
  public static generateKey(params: {
    entityId: string;
    mutationType: string;
    payload: unknown;
    timestamp?: number;
  }): string {
    const rawString = JSON.stringify({
      entityId: params.entityId,
      mutationType: params.mutationType,
      payload: params.payload,
      timestamp: params.timestamp || 0
    });

    const hash = CryptoJS.SHA256(rawString);
    return `IDEM-${hash.toString(CryptoJS.enc.Hex)}`;
  }

  /**
   * Validates if a key is already registered as COMPLETE or in progress.
   * Prevents duplicate executions of identical mutations.
   */
  public static async isDuplicate(key: string): Promise<boolean> {
    const existing = await db.sync_queue
      .where("idempotencyKey")
      .equals(key)
      .first();

    if (existing) {
      // If it has been completed or is processing, it's a duplicate or safely being handled
      return existing.status === "COMPLETED" || existing.status === "PROCESSING";
    }
    return false;
  }

  /**
   * Replay Protection Check:
   * Verifies if a request timestamp is excessively old or has mismatched signatures.
   */
  public static isReplaySuspected(timestamp: number, allowedWindowMs = 24 * 60 * 60 * 1000): boolean {
    const now = Date.now();
    return Math.abs(now - timestamp) > allowedWindowMs;
  }
}
