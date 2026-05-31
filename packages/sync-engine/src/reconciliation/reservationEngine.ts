// packages/sync-engine/src/reconciliation/reservationEngine.ts
import { db } from "@/core/db";

export interface Reservation {
  reservationId: string;
  productId: string;
  quantity: number;
  expiresAt: string; // ISO string
  deviceId: string;
  status: "ACTIVE" | "COMMITTED" | "RELEASED" | "EXPIRED";
}

export class ReservationEngine {
  /**
   * Acquire a temporary stock reservation for safe local and sync checkouts.
   */
  public static async reserve(
    productId: string,
    quantity: number,
    ttlSeconds = 300,
    deviceId: string
  ): Promise<Reservation | null> {
    // 1. Fetch current product
    const product = await db.products.get(productId);
    if (!product) return null;

    // 2. Validate availability
    const reservedSum = await this.getActiveReservationTotal(productId);
    const available = product.stock - reservedSum;

    if (available < quantity) {
      console.warn(`[ReservationEngine] Insufficient stock. Wanted: ${quantity}, Available: ${available}, Actual stock: ${product.stock}`);
      return null;
    }

    // 3. Create reservation
    const reservationId = db.generateId("RES");
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const reservation: Reservation = {
      reservationId,
      productId,
      quantity,
      expiresAt,
      deviceId,
      status: "ACTIVE"
    };

    // Store in settings-backed or dedicated custom storage - let's save dynamically in 'settings' or a table if we prefer
    // Since settings is key-value, we can save keys prefixed by RESERVATION_
    await db.settings.put({
      key: `RESERVATION_${reservationId}`,
      value: reservation
    });

    return reservation;
  }

  /**
   * Calculates current active total reservation sum for a product
   */
  public static async getActiveReservationTotal(productId: string): Promise<number> {
    const records = await db.settings
      .where("key")
      .startsWith("RESERVATION_")
      .toArray();

    let total = 0;
    const now = Date.now();

    for (const record of records) {
      const res: Reservation = record.value;
      if (res && res.productId === productId && res.status === "ACTIVE") {
        if (new Date(res.expiresAt).getTime() > now) {
          total += res.quantity;
        } else {
          // Auto-mark expired inline
          res.status = "EXPIRED";
          await db.settings.put({ key: record.key, value: res });
        }
      }
    }
    return total;
  }

  /**
   * Commit a reservation once the purchase is confirmed.
   */
  public static async commit(reservationId: string): Promise<boolean> {
    const record = await db.settings.get(`RESERVATION_${reservationId}`);
    if (!record) return false;

    const res: Reservation = record.value;
    if (res.status !== "ACTIVE") return false;

    res.status = "COMMITTED";
    await db.settings.put({ key: `RESERVATION_${reservationId}`, value: res });
    return true;
  }

  /**
   * Rollback / release a reservation.
   */
  public static async rollback(reservationId: string): Promise<boolean> {
    const record = await db.settings.get(`RESERVATION_${reservationId}`);
    if (!record) return false;

    const res: Reservation = record.value;
    res.status = "RELEASED";
    await db.settings.put({ key: `RESERVATION_${reservationId}`, value: res });
    return true;
  }

  /**
   * Periodically scrub and clean up expired reservations.
   */
  public static async scrubExpired(): Promise<number> {
    const records = await db.settings
      .where("key")
      .startsWith("RESERVATION_")
      .toArray();

    const now = Date.now();
    let count = 0;

    for (const record of records) {
      const res: Reservation = record.value;
      if (res && (res.status === "ACTIVE" && new Date(res.expiresAt).getTime() <= now)) {
        res.status = "EXPIRED";
        await db.settings.put({ key: record.key, value: res });
        count++;
      }
    }
    return count;
  }
}
