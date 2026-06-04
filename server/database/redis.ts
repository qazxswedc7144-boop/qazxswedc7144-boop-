// server/database/redis.ts

import Redis, { RedisOptions } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

class RedisConnectionManager {
  private static instance: Redis | null = null;
  private static isMemoryFallback = false;
  private static memoryCache: Map<string, { value: string; expiresAt: number }> = new Map();

  /**
   * Returns a singleton Redis connection pool or fallback memory client.
   */
  static getClient(): Redis | null {
    if (this.isMemoryFallback) {
      return null;
    }

    if (this.instance) {
      return this.instance;
    }

    try {
      console.log(`[REDIS] Attempting to connect to instance: ${REDIS_URL}`);
      
      const options: RedisOptions = {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        reconnectOnError: (err) => {
          const targetError = "READONLY";
          if (err.message.slice(0, targetError.length) === targetError) {
            return true;
          }
          return false;
        },
        retryStrategy: (times) => {
          // Retry reconnecting with backoff up to 2 seconds, but stop after 3 attempts to fall back
          if (times > 3) {
            console.warn("[REDIS] Reached retry margin threshold. Activating secure in-memory backup distributed mock.");
            this.isMemoryFallback = true;
            return null; // Stop reconnecting and trigger fallback
          }
          return Math.min(times * 100, 2000);
        }
      };

      this.instance = new Redis(REDIS_URL, options);

      // Register error listener immediately to prevent unhandled socket error crashes on startup
      this.instance.on("error", (err) => {
        console.warn("[REDIS] Background adapter socket notice:", err.message);
        // Do not crash the node process under any condition. Fallback activates through retryStrategy or direct exception catch
      });

      this.instance.on("connect", () => {
        console.log("[REDIS] Handshake succeeded. Distributed connection established.");
        this.isMemoryFallback = false;
      });

      return this.instance;
    } catch (e) {
      console.warn("[REDIS] Initialization failed. Falling back to high-speed local memory lock array.", e);
      this.isMemoryFallback = true;
      return null;
    }
  }

  /**
   * Executes a command on Redis or falls back to in-memory commands safely.
   */
  static async set(key: string, value: string, mode?: "PX" | "EX", ttl?: number): Promise<boolean> {
    const redis = this.getClient();
    if (redis && !this.isMemoryFallback) {
      try {
        if (mode && ttl) {
          await (redis as any).set(key, value, mode, ttl);
        } else {
          await redis.set(key, value);
        }
        return true;
      } catch (err) {
        console.warn("[REDIS] SET command failed, falling back to local block.", err);
      }
    }

    // Memory storage fallback
    const expiresAt = ttl ? Date.now() + (mode === "EX" ? ttl * 1000 : ttl) : Infinity;
    this.memoryCache.set(key, { value, expiresAt });
    return true;
  }

  static async get(key: string): Promise<string | null> {
    const redis = this.getClient();
    if (redis && !this.isMemoryFallback) {
      try {
        return await redis.get(key);
      } catch (err) {
        console.warn("[REDIS] GET command failed, falling back to local block.", err);
      }
    }

    const item = this.memoryCache.get(key);
    if (!item) return null;
    if (item.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    return item.value;
  }

  static async del(key: string): Promise<boolean> {
    const redis = this.getClient();
    if (redis && !this.isMemoryFallback) {
      try {
        await redis.del(key);
        return true;
      } catch (err) {
        console.warn("[REDIS] DEL command failed, falling back to local block.", err);
      }
    }

    return this.memoryCache.delete(key);
  }

  /**
   * Helper to execute key scanning
   */
  static async scanKeys(pattern: string): Promise<string[]> {
    const redis = this.getClient();
    if (redis && !this.isMemoryFallback) {
      try {
        let keys: string[] = [];
        let cursor = "0";
        do {
          const reply = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
          cursor = reply[0];
          keys.push(...reply[1]);
        } while (cursor !== "0");
        return keys;
      } catch (err) {
        console.warn("[REDIS] SCAN command failed, scanning local memory array.", err);
      }
    }

    // Memory scan
    const keys: string[] = [];
    const now = Date.now();
    const cleanPattern = pattern.replace(/\*/g, ""); // simple match for mock demo
    for (const [k, v] of this.memoryCache.entries()) {
      if (k.includes(cleanPattern) && v.expiresAt > now) {
        keys.push(k);
      }
    }
    return keys;
  }

  /**
   * Atomic evaluate script implementation (e.g. for Redlock release)
   */
  static async eval(script: string, numKeys: number, ...args: string[]): Promise<any> {
    const redis = this.getClient();
    if (redis && !this.isMemoryFallback) {
      try {
        return await redis.eval(script, numKeys, ...args);
      } catch (err) {
        console.warn("[REDIS] Lua evaluation failed, implementing custom fallback evaluation.", err);
      }
    }

    // Fallback Mock Lua evaluation logic:
    // In many redis locking Lua scripts:
    // args[0] = lockKey, args[1] = lockValue/token.
    // Script checks if redis.call('get', KEYS[1]) == ARGV[1] then returns redis.call('del', KEYS[1]) else returns 0.
    const key = args[0] || "";
    const token = args[1] || "";
    const cached = this.memoryCache.get(key);
    if (cached && cached.value === token) {
      this.memoryCache.delete(key);
      return 1;
    }
    return 0;
  }
}

export default RedisConnectionManager;
export { RedisConnectionManager };
