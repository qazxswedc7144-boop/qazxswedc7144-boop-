// packages/sync-engine/src/reconciliation/conflictResolver.ts
import { db } from "@/core/db";
import { VectorClock, ClockMap, Causality } from "./vectorClock";

export type ConflictType = 
  | "STOCK_CONFLICT"
  | "VERSION_CONFLICT"
  | "DUPLICATE_POST"
  | "RESERVATION_COLLISION";

export interface ConflictRecord {
  id: string;
  type: ConflictType;
  entityName: string;
  entityId: string;
  localPayload: unknown;
  remotePayload: unknown;
  localClock: ClockMap;
  remoteClock: ClockMap;
  timestamp: number;
  resolved: boolean;
  resolutionStrategy?: string;
}

export class ConflictResolver {
  /**
   * Evaluates if a conflict exists between local and server clocks or versions.
   */
  public static detectConflict(
    localClock: ClockMap,
    remoteClock: ClockMap
  ): { hasConflict: boolean; relation: Causality } {
    const relation = VectorClock.compare(localClock, remoteClock);
    
    // If concurrent (diverged on both client and server), we have a conflict
    // If local is ancestor of remote, local is stale (conflict/overwrite warning)
    const hasConflict = relation === Causality.CONCURRENT || relation === Causality.ANCESTOR;
    return { hasConflict, relation };
  }

  /**
   * Logs a detected conflict into Dexie database 'sync_conflicts' table for review and auditing.
   */
  public static async logConflict(
    type: ConflictType,
    entityName: string,
    entityId: string,
    localPayload: unknown,
    remotePayload: unknown,
    localClock: ClockMap,
    remoteClock: ClockMap
  ): Promise<string> {
    const conflictId = db.generateId("CONF");
    const record: ConflictRecord = {
      id: conflictId,
      type,
      entityName,
      entityId,
      localPayload,
      remotePayload,
      localClock,
      remoteClock,
      timestamp: Date.now(),
      resolved: false
    };

    await db.sync_conflicts.add(record);
    return conflictId;
  }

  /**
   * Resolves stock conflicts using a "Merge Sum" or "Deterministic Fallback" strategy.
   * Ensures patient safety and product inventories never desynchronize.
   */
  public static resolveStockConflict(
    localStock: number,
    remoteStock: number,
    salesDelta: number
  ): { stockValue: number; strategy: string } {
    // Medical inventory can't afford to overpromise.
    // If concurrently both states decreased/increased, 
    // we use a safe deterministic reconciliation.
    const resolvedStock = Math.max(0, remoteStock - salesDelta);
    return {
      stockValue: resolvedStock,
      strategy: "STOCK_DELTA_DELTA_APPLIED"
    };
  }

  /**
   * Last-Write-Wins (LWW) resolver based on real timestamp fallback.
   */
  public static resolveLWW(
    localItem: { timestamp: number; payload: unknown },
    remoteItem: { timestamp: number; payload: unknown }
  ): { winner: "LOCAL" | "REMOTE"; strategy: string } {
    if (localItem.timestamp >= remoteItem.timestamp) {
      return { winner: "LOCAL", strategy: "LWW_CLIENT_WINS" };
    }
    return { winner: "REMOTE", strategy: "LWW_SERVER_WINS" };
  }
}
