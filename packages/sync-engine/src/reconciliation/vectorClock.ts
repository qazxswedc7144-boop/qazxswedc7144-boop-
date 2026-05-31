// packages/sync-engine/src/reconciliation/vectorClock.ts

export type ClockMap = Record<string, number>;

export enum Causality {
  CONCURRENT = "CONCURRENT",
  ANCESTOR = "ANCESTOR",
  DESCENDANT = "DESCENDANT",
  EQUAL = "EQUAL"
}

export class VectorClock {
  public static increment(clock: ClockMap, nodeId: string): ClockMap {
    const updated = { ...clock };
    updated[nodeId] = (updated[nodeId] || 0) + 1;
    return updated;
  }

  /**
   * Compares two vector clocks.
   * Returns ANCESTOR if clockA happened before clockB.
   * Returns DESCENDANT if clockA happened after clockB.
   * Returns EQUAL if they are identical.
   * Returns CONCURRENT if they diverged concurrently.
   */
  public static compare(clockA: ClockMap, clockB: ClockMap): Causality {
    let greater = false;
    let lesser = false;

    // Union of all keys in both clocks
    const keys = new Set([...Object.keys(clockA), ...Object.keys(clockB)]);

    for (const key of keys) {
      const valA = clockA[key] || 0;
      const valB = clockB[key] || 0;

      if (valA > valB) {
        greater = true;
      } else if (valA < valB) {
        lesser = true;
      }
    }

    if (greater && lesser) {
      return Causality.CONCURRENT;
    } else if (greater) {
      return Causality.DESCENDANT;
    } else if (lesser) {
      return Causality.ANCESTOR;
    } else {
      return Causality.EQUAL;
    }
  }

  /**
   * Merges two vector clock records by taking the element-wise maximum
   */
  public static merge(clockA: ClockMap, clockB: ClockMap): ClockMap {
    const result: ClockMap = { ...clockA };
    for (const [key, valB] of Object.entries(clockB)) {
      result[key] = Math.max(result[key] || 0, valB);
    }
    return result;
  }
}
