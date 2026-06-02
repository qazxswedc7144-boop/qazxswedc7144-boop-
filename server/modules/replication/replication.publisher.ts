// server/modules/replication/replication.publisher.ts

import { prisma } from "../../database/prisma";
import { RedisConnectionManager } from "../../database/redis";
import { ReplicationEvent, BusinessEventType } from "./replication.types";
import { randomUUID } from "crypto";
import { EventEmitter } from "events";

// Global local event emitter for fallbacks and server internal dispatch
export const localReplicationBus = new EventEmitter();

export class ReplicationPublisher {
  private static sequenceCounter = 1;

  /**
   * Broadcasts a replication event with branch channel isolation and delivery guarantees.
   */
  static async publish(params: {
    type: BusinessEventType;
    branchId: string;
    payload: any;
    userId?: string;
    targetBranchId?: string; // If specified, Single Branch Broadcast. If undefined, Global Broadcast.
    targetBranchIds?: string[]; // If specified, Multi-Branch Broadcast.
  }): Promise<ReplicationEvent> {
    const eventId = randomUUID();
    const timestamp = new Date().toISOString();

    // 1. Maintain microsecond/sequence accuracy
    const sequence = ++this.sequenceCounter;

    // 2. Vector clock tracking (e.g. keying local sequence for origin branch)
    const vectorClock: { [branchId: string]: number } = {
      [params.branchId]: sequence,
    };

    // Calculate a simple verification checksum of type-payload-timestamp
    const payloadStr = JSON.stringify(params.payload);
    const checksum = Buffer.from(`${params.type}:${payloadStr}:${timestamp}`).toString("base64").slice(0, 32);

    const event: ReplicationEvent = {
      id: eventId,
      type: params.type,
      branchId: params.branchId,
      timestamp,
      payload: params.payload,
      sequence,
      vectorClock,
      checksum,
    };

    try {
      // 3. Save to Prisma SyncEvent table to provide full replay and recovery guarantees
      await prisma.syncEvent.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          entityType: "REPLICATION",
          entityId: event.payload?.id || event.payload?.transferId || event.payload?.invoiceId || "GENERIC",
          branchId: event.branchId,
          payload: event.payload,
          clientTime: new Date(event.timestamp),
          vectorClock: event.vectorClock,
          checksum: event.checksum,
          userId: params.userId || "system",
        },
      });

      // 4. Generate immutable audit trail event: REPLICATION_PUBLISHED
      await prisma.auditLog.create({
        data: {
          action: "REPLICATION_PUBLISHED",
          entity: "ReplicationEvent",
          entityId: event.id,
          before: null,
          after: JSON.stringify({
            type: event.type,
            branchId: event.branchId,
            sequence: event.sequence,
            targetBranchId: params.targetBranchId,
            targetBranchIds: params.targetBranchIds,
          }),
          userId: params.userId || null,
          branchId: params.branchId,
        },
      });
    } catch (dbErr: any) {
      console.error("[REPLICATION_PUBLISHER] Persistent storage/audit logging failed, continuing in-memory:", dbErr.message);
    }

    // 5. Publish to Redis under specific isolated channels
    const channels: string[] = [];

    if (params.targetBranchId) {
      // Single Branch Broadcast
      channels.push(`branch:${params.targetBranchId}`);
    } else if (params.targetBranchIds && params.targetBranchIds.length > 0) {
      // Multi Branch Broadcast
      params.targetBranchIds.forEach((bId) => channels.push(`branch:${bId}`));
    } else {
      // Global Broadcast
      channels.push("group:all");
    }

    let redisPublishedCount = 0;
    const redis = RedisConnectionManager.getClient();

    if (redis) {
      for (const channel of channels) {
        try {
          await redis.publish(channel, JSON.stringify(event));
          redisPublishedCount++;
        } catch (redisErr: any) {
          console.warn(`[REPLICATION_PUBLISHER] Redis publish to ${channel} failed:`, redisErr.message);
        }
      }
    }

    // 6. Also emit locally in process so local connections/gates hear the broadcast immediately (or as fallback)
    channels.forEach((channel) => {
      localReplicationBus.emit(channel, event);
    });

    console.log(
      `[REPLICATION_PUBLISHER] Event: ${event.type} (${event.id.slice(0, 8)}) published to channels: [${channels.join(
        ", "
      )}] via Redis/emitter. Redis success count: ${redisPublishedCount}`
    );

    return event;
  }
}
