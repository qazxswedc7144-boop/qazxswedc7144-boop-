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
  private static inFlightKeys = new Set<string>();

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
    // 1. Immediately block if already in-flight in this process thread
    if (this.inFlightKeys.has(key)) {
      metrics.concurrentLockPrevention++;
      logger.warn({ key, endpoint, method }, "Locked concurrent execution prevented via in-flight registry.");
      throw new Error("CONCURRENT_LOCK");
    }

    // Capture the atomic synchronous lock for this thread segment
    this.inFlightKeys.add(key);

    try {
      const hash = this.generateRequestHash(endpoint, method, body, userId);
      const existing = await IdempotencyRepository.findByKey(key);

      if (existing) {
        // If already marked as processing (meaning another container/thread, or previous crash lock)
        if (existing.processing) {
          metrics.concurrentLockPrevention++;
          logger.warn({ key, endpoint, method }, "Concurrent attempt blocked right after retrieval conflict.");
          throw new Error("CONCURRENT_LOCK");
        }

        // Validate request hash integrity
        if (existing.requestHash !== hash) {
          metrics.hashMismatches++;
          logger.error(
            { key, existingHash: existing.requestHash, incomingHash: hash, endpoint, method },
            "Idempotency key abuse security check failed. Body payload mismatch."
          );
          throw new Error("HASH_MISMATCH");
        }

        // Safe to replay!
        metrics.preventedDuplicates++;
        metrics.replayedRequests++;
        logger.info(
          { key, responseStatus: existing.responseStatus, endpoint },
          "Duplicate attempt intercepted. Replaying previous safe financial outcome."
        );

        // Remove from dynamic thread lock since we are bypassing the actual route processing anyway
        this.inFlightKeys.delete(key);

        return {
          status: "REPLAY",
          code: existing.responseStatus ?? 200,
          body: existing.responseBody
        };
      }

      // Key is free. Attempt database/memory level transaction lock
      const { record, isNew } = await IdempotencyRepository.acquireLock(
        key,
        hash,
        endpoint,
        method,
        userId
      );

      if (!isNew && record.processing) {
        metrics.concurrentLockPrevention++;
        logger.warn({ key, endpoint, method }, "Concurrent attempt blocked on db lock acquisition.");
        throw new Error("CONCURRENT_LOCK");
      }

      logger.info({ key, endpoint, method, userId, hash }, "Idempotency key acquired. Proceeding to process.");
      return { status: "PROCESS", hash };
    } catch (err) {
      // Release inflight lock on pre-request failure to ensure subsequent retries can proceed
      this.inFlightKeys.delete(key);
      throw err;
    }
  }

  /**
   * Finalizes an idempotent operations stack with its response payload
   */
  static async resolveRequest(key: string, responseStatus: number, responseBody: any): Promise<void> {
    this.inFlightKeys.delete(key);
    await IdempotencyRepository.resolveKey(key, responseBody, responseStatus);
    logger.debug({ key, responseStatus }, "Idempotent response result cached successfully.");
  }

  /**
   * Cleans/undoes locks in case of errors on non-idempotent exceptions
   */
  static async releaseLock(key: string): Promise<void> {
    this.inFlightKeys.delete(key);
    await IdempotencyRepository.releaseLock(key);
    logger.warn({ key }, "Processing lock released due to system recovery intervention.");
  }
}
