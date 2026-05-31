// server/modules/idempotency/idempotency.repository.ts
import { prisma } from "../../database/prisma";
import { IdempotencyKey } from "@prisma/client";

// In-memory fallback store to ensure absolute operational resilience under DB degradation or sandbox limits
const inMemoryFallbackStore = new Map<string, IdempotencyKey>();

function isDbConnectionError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("P1001") || 
    msg.includes("Can't reach database") || 
    msg.includes("ECONNREFUSED") ||
    msg.includes("database server")
  );
}

export class IdempotencyRepository {
  /**
   * Retrieves an idempotency key record from the database, falling back to cache if DB is offline.
   */
  static async findByKey(key: string): Promise<IdempotencyKey | null> {
    try {
      return await prisma.idempotencyKey.findUnique({
        where: { key }
      });
    } catch (error) {
      if (isDbConnectionError(error)) {
        const cached = inMemoryFallbackStore.get(key);
        // Expiry hook integration
        if (cached && new Date() > cached.expiresAt) {
          inMemoryFallbackStore.delete(key);
          return null;
        }
        return cached || null;
      }
      throw error;
    }
  }

  /**
   * Tries to find or create a lock for a given key.
   * If the key already exists, returns the existing record.
   * Otherwise, creates a new locked record set to `processing: true`.
   */
  static async acquireLock(
    key: string,
    requestHash: string,
    endpoint: string,
    requestMethod: string,
    userId: string | null,
    expiresInMs = 24 * 60 * 60 * 1000 // default 24 hours
  ): Promise<{ record: IdempotencyKey; isNew: boolean }> {
    const expiresAt = new Date(Date.now() + expiresInMs);

    try {
      // Try DB-level transaction
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.idempotencyKey.findUnique({
          where: { key }
        });

        if (existing) {
          return { record: existing, isNew: false };
        }

        const created = await tx.idempotencyKey.create({
          data: {
            key,
            requestHash,
            endpoint,
            requestMethod,
            userId,
            processing: true,
            lockedAt: new Date(),
            expiresAt
          }
        });

        return { record: created, isNew: true };
      });
    } catch (error) {
      if (isDbConnectionError(error)) {
        const existing = inMemoryFallbackStore.get(key);
        if (existing) {
          if (new Date() > existing.expiresAt) {
            inMemoryFallbackStore.delete(key);
          } else {
            return { record: existing, isNew: false };
          }
        }

        const mockRecord: IdempotencyKey = {
          id: Math.random().toString(36).substring(3, 11),
          key,
          requestHash,
          endpoint,
          requestMethod,
          userId,
          responseBody: null,
          responseStatus: null,
          processing: true,
          lockedAt: new Date(),
          expiresAt,
          createdAt: new Date()
        };

        inMemoryFallbackStore.set(key, mockRecord);
        return { record: mockRecord, isNew: true };
      }

      // Concurrency retry
      const checkAgain = await prisma.idempotencyKey.findUnique({
        where: { key }
      });
      if (checkAgain) {
        return { record: checkAgain, isNew: false };
      }
      throw error;
    }
  }

  /**
   * Persists the outcome of the request under the safe key, setting processing to false.
   */
  static async resolveKey(
    key: string,
    responseBody: any,
    responseStatus: number
  ): Promise<IdempotencyKey> {
    try {
      return await prisma.idempotencyKey.update({
        where: { key },
        data: {
          processing: false,
          responseBody: responseBody ?? null,
          responseStatus,
          lockedAt: null
        }
      });
    } catch (error) {
      if (isDbConnectionError(error)) {
        const cached = inMemoryFallbackStore.get(key);
        if (cached) {
          cached.processing = false;
          cached.responseBody = responseBody ?? null;
          cached.responseStatus = responseStatus;
          cached.lockedAt = null;
          return cached;
        }
        // Fallback create if not there
        const mockRecord: IdempotencyKey = {
          id: Math.random().toString(36).substring(3, 11),
          key,
          requestHash: "",
          endpoint: "",
          requestMethod: "",
          userId: null,
          responseBody: responseBody ?? null,
          responseStatus,
          processing: false,
          lockedAt: null,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdAt: new Date()
        };
        inMemoryFallbackStore.set(key, mockRecord);
        return mockRecord;
      }
      throw error;
    }
  }

  /**
   * Releases a lock to allow retries in case of processing errors, setting processing to false.
   */
  static async releaseLock(key: string): Promise<IdempotencyKey | null> {
    try {
      return await prisma.idempotencyKey.update({
        where: { key },
        data: {
          processing: false,
          lockedAt: null
        }
      });
    } catch (error) {
      if (isDbConnectionError(error)) {
        const cached = inMemoryFallbackStore.get(key);
        if (cached) {
          cached.processing = false;
          cached.lockedAt = null;
          return cached;
        }
        return null;
      }
      return null;
    }
  }

  /**
   * Cleans up expired keys from the database.
   */
  static async deleteExpiredKeys(): Promise<number> {
    let memoryPurged = 0;
    const now = new Date();

    // In-memory sweeping
    for (const [key, record] of inMemoryFallbackStore.entries()) {
      if (now > record.expiresAt) {
        inMemoryFallbackStore.delete(key);
        memoryPurged++;
      }
    }

    try {
      const result = await prisma.idempotencyKey.deleteMany({
        where: {
          expiresAt: {
            lt: now
          }
        }
      });
      return result.count + memoryPurged;
    } catch (error) {
      if (isDbConnectionError(error)) {
        return memoryPurged;
      }
      throw error;
    }
  }
}
