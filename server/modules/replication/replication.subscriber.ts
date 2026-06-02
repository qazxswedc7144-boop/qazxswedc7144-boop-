// server/modules/replication/replication.subscriber.ts

import Redis, { RedisOptions } from "ioredis";
import { prisma } from "../../database/prisma";
import { localReplicationBus } from "./replication.publisher";
import { ReplicationEvent } from "./replication.types";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

type MessageHandler = (channel: string, event: ReplicationEvent) => void;

export class ReplicationSubscriber {
  private static subClient: Redis | null = null;
  private static isSubscribed = false;
  private static processedEvents = new Set<string>(); // Deduplication cache
  private static handlers: Set<MessageHandler> = new Set();

  /**
   * Initialize the subscription listener, connecting to Redis Pub/Sub.
   */
  static async start(): Promise<void> {
    if (this.isSubscribed) return;

    // 1. Hook up to our local in-memory event bus to support seamless local-mode fallback
    localReplicationBus.on("branch:*", (event: ReplicationEvent) => {
      this.handleIncomingMessage("local_bus", event);
    });
    
    localReplicationBus.on("group:all", (event: ReplicationEvent) => {
      this.handleIncomingMessage("group:all", event);
    });

    // Also listen to any dynamically emitted channel on localReplicationBus
    const originalEmit = localReplicationBus.emit.bind(localReplicationBus);
    localReplicationBus.emit = (event: string | symbol, ...args: any[]): boolean => {
      if (typeof event === "string" && (event.startsWith("branch:") || event === "group:all")) {
        const payload = args[0] as ReplicationEvent;
        if (payload && payload.id) {
          this.handleIncomingMessage(event, payload);
        }
      }
      return originalEmit(event, ...args);
    };

    // 2. Initialize Redis Subscription client
    try {
      console.log(`[REPLICATION_SUBSCRIBER] Connecting to Pub/Sub on: ${REDIS_URL}`);
      const options: RedisOptions = {
        maxRetriesPerRequest: null, // Subscriptions shouldn't limit retries
        enableOfflineQueue: true,
        retryStrategy: (times) => {
          // Keep trying to reconnect to Redis Pub/Sub in background every 3 seconds
          return Math.min(times * 150, 3000);
        }
      };

      this.subClient = new Redis(REDIS_URL, options);

      this.subClient.on("connect", async () => {
        console.log("✅ [REPLICATION_SUBSCRIBER] Redis Pub/Sub connection established.");
        try {
          if (this.subClient) {
            // Subscribe to global and all branch-specific channels using pattern matching
            await this.subClient.psubscribe("branch:*", "group:all");
            console.log("🚀 [REPLICATION_SUBSCRIBER] Registered subscriptions for branch:* and group:all");
          }
        } catch (subErr: any) {
          console.error("[REPLICATION_SUBSCRIBER] Redis subscribe failed:", subErr.message);
        }
      });

      this.subClient.on("pmessage", (_pattern, channel, message) => {
        try {
          const event: ReplicationEvent = JSON.parse(message);
          this.handleIncomingMessage(channel, event);
        } catch (jsonErr: any) {
          console.warn(`[REPLICATION_SUBSCRIBER] Failed to parse message on ${channel}:`, jsonErr.message);
        }
      });

      this.subClient.on("error", (err) => {
        console.warn("[REPLICATION_SUBSCRIBER] Redis subscription background adapter socket notice:", err.message);
      });

      this.isSubscribed = true;
    } catch (e: any) {
      console.warn("[REPLICATION_SUBSCRIBER] Failed to initialize Redis subscriber, relying solely on local memory fallback:", e.message || e);
      this.isSubscribed = true; // Still marked as active so we don't spam start calls
    }
  }

  /**
   * Register a custom handler that receives parsed replication events.
   */
  static addMessageHandler(handler: MessageHandler): void {
    this.handlers.add(handler);
  }

  /**
   * Unregister custom handler.
   */
  static removeMessageHandler(handler: MessageHandler): void {
    this.handlers.delete(handler);
  }

  /**
   * Central ingress processing for deduplication, logging, and broadcasting.
   */
  private static async handleIncomingMessage(channel: string, event: ReplicationEvent) {
    if (!event || !event.id) return;

    // 1. Prevent duplicate processing across overlapping channels or reconnects
    if (this.processedEvents.has(event.id)) {
      return; // Already processed
    }

    // Mark as processed (deduplication)
    this.processedEvents.add(event.id);

    // Limit memory usage of our deduplication set
    if (this.processedEvents.size > 20000) {
      const iterator = this.processedEvents.values();
      for (let i = 0; i < 5000; i++) {
        const val = iterator.next().value;
        if (val) this.processedEvents.delete(val);
      }
    }

    console.log(`[REPLICATION_SUBSCRIBER] Received message on channel ${channel}: ${event.type} (ID: ${event.id.slice(0, 8)})`);

    try {
      // 2. Log immutable received event into Audit Logs
      await prisma.auditLog.create({
        data: {
          action: "REPLICATION_RECEIVED",
          entity: "ReplicationEvent",
          entityId: event.id,
          before: null,
          after: JSON.stringify({
            type: event.type,
            branchId: event.branchId,
            sequence: event.sequence,
            receivedChannel: channel,
          }),
          userId: "system",
          branchId: event.branchId,
        },
      });
    } catch (auditErr: any) {
      console.error("[REPLICATION_SUBSCRIBER] Audit logging of REPLICATION_RECEIVED failed:", auditErr.message);
    }

    // 3. Dispatch to all active handlers (e.g., WebSocket active gateways)
    this.handlers.forEach((handler) => {
      try {
        handler(channel, event);
      } catch (err: any) {
        console.error("[REPLICATION_SUBSCRIBER] Handler error:", err.message);
      }
    });
  }
}
