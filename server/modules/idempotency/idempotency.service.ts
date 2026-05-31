// server/modules/idempotency/idempotency.service.ts
import crypto from "crypto";
import pino from "pino";
import { IdempotencyRepository } from "./idempotency.repository";
import { IdempotencyMetrics } from "./idempotency.types";

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  base: { service: "pharmaflow-idempotency" },
  timestamp: pino.stdTimeFunctions.isoTime
});

// High-performance atomic in-memory counters for system metrics
const metrics: IdempotencyMetrics = {
  preventedDuplicates: 0,
  replayedRequests: 0,
  hashMismatches: 0,
  concurrentLockPrevention: 0
};

export class IdempotencyService {
  /**
   * Generates a unique SHA-256 fingerprint for a request based on:
   * - endpoint route
   * - request method
   * - request body payload
   * - authenticated user ID
   */
  static generateRequestHash(
    endpoint: string,
    method: string,
    body: any,
    userId: string | null
  ): string {
    const serializedBody = typeof body === "string" 
      ? body 
      : JSON.stringify(body ?? {});
      
    const rawString = `${method.toUpperCase()}:${endpoint}:${serializedBody}:${userId ?? "anonymous"}`;
    return crypto.createHash("sha256").update(rawString).digest("hex");
  }

  /**
   * Safe getter for current metrics
   */
  static getMetrics(): IdempotencyMetrics {
    return { ...metrics };
  }

  /**
   * Core execution controller. Checks idempotency conditions.
   * - If no key is provided, signals middleware to bypass.
   * - If the key is new, acquires lock, executes, logs resolutions.
   * - If the key is locked and processing, throws a LockConflict error.
   * - If the key is completed, compares request hash. If hashes mismatch, throws HashMismatch error.
   *   Otherwise, replays the cached response.
   */
  static async handlePreRequest(
    key: string,
    endpoint: string,
    method: string,
    body: any,
    userId: string | null
  ): Promise<{ status: "PROCESS"; hash: string } | { status: "REPLAY"; code: number; body: any }> {
    const hash = this.generateRequestHash(endpoint, method, body, userId);

    const existing = await IdempotencyRepository.findByKey(key);

    if (!existing) {
      // Key is completely free. Attempt to secure lock
      const { record, isNew } = await IdempotencyRepository.acquireLock(
        key,
        hash,
        endpoint,
        method,
        userId
      );

      if (isNew) {
        logger.info({ key, endpoint, method, userId, hash }, "Idempotency key acquired. Proceeding to process.");
        return { status: "PROCESS", hash };
      }

      // If concurrent request won the race between find and acquireLock
      if (record.processing) {
        metrics.concurrentLockPrevention++;
        logger.warn({ key, endpoint, method }, "Concurrent attempt blocked right after acquisition conflict.");
        throw new Error("CONCURRENT_LOCK");
      }
    }

    // Since 'existing' was retrieved or we hit an update
    const record = existing || (await IdempotencyRepository.findByKey(key))!;

    // 1. Check if it's currently processing (race condition / double-click)
    if (record.processing) {
      metrics.concurrentLockPrevention++;
      logger.warn({ key, endpoint, method }, "Locked concurrent execution prevented.");
      throw new Error("CONCURRENT_LOCK");
    }

    // 2. Validate request hash integrity to protect against token reuse/hijacking with different body payloads
    if (record.requestHash !== hash) {
      metrics.hashMismatches++;
      logger.error(
        { key, existingHash: record.requestHash, incomingHash: hash, endpoint, method },
        "Idempotency key abuse security check failed. Body payload mismatch."
      );
      throw new Error("HASH_MISMATCH");
    }

    // 3. Request is safe to replay! Re-deliver original response.
    metrics.preventedDuplicates++;
    metrics.replayedRequests++;
    logger.info(
      { key, responseStatus: record.responseStatus, endpoint },
      "Duplicate attempt intercepted. Replaying previous safe financial outcome."
    );

    return {
      status: "REPLAY",
      code: record.responseStatus ?? 200,
      body: record.responseBody
    };
  }

  /**
   * Finalizes an idempotent operations stack with its response payload
   */
  static async resolveRequest(key: string, responseStatus: number, responseBody: any): Promise<void> {
    await IdempotencyRepository.resolveKey(key, responseBody, responseStatus);
    logger.debug({ key, responseStatus }, "Idempotent response result cached successfully.");
  }

  /**
   * Cleans/undoes locks in case of errors on non-idempotent exceptions
   */
  static async releaseLock(key: string): Promise<void> {
    await IdempotencyRepository.releaseLock(key);
    logger.warn({ key }, "Processing lock released due to system recovery intervention.");
  }
}
