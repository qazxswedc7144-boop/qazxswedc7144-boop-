// apps/api/src/modules/audit/audit.service.ts
import { AuditRepository } from "./audit.repository";
import { AuditLogPayload } from "./audit.types";
import crypto from "crypto";

export class AuditService {
  /**
   * Safe, append-only logger of core mutations containing cryptographic UUID correlation.
   */
  static async log(payload: AuditLogPayload) {
    try {
      const eventId = crypto.randomUUID();
      const doc = await AuditRepository.create({
        ...payload,
        action: payload.action
      });
      return { success: true, eventId, docId: doc.id };
    } catch (err: any) {
      console.warn("⚠️ Immutable audit record injection failed:", err.message);
      return { success: false, error: err.message };
    }
  }

  static async logInvoiceCreated(userId: string, invoiceId: string, payload: any, ip?: string) {
    return this.log({
      userId,
      action: "INVOICE_CREATE",
      entity: "Invoice",
      entityId: invoiceId,
      after: JSON.stringify(payload),
      ipAddress: ip
    });
  }

  static async logInvoiceApproved(userId: string, invoiceId: string, payload: any, ip?: string) {
    return this.log({
      userId,
      action: "INVOICE_APPROVE",
      entity: "Invoice",
      entityId: invoiceId,
      after: JSON.stringify(payload),
      ipAddress: ip
    });
  }

  static async logStockAdjusted(userId: string, productId: string, payload: any, ip?: string) {
    return this.log({
      userId,
      action: "STOCK_ADJUSTMENT",
      entity: "Product",
      entityId: productId,
      after: JSON.stringify(payload),
      ipAddress: ip
    });
  }

  static async logLoginAttempt(userId: string | undefined, username: string, status: "SUCCESS" | "FAILED", ip?: string) {
    return this.log({
      userId,
      action: status === "SUCCESS" ? "USER_LOGIN" : "AUTH_FAILURE",
      entity: "User",
      entityId: username,
      after: status === "SUCCESS" ? "SUCCESSFUL_JWT" : "INVALID_PASSWORD",
      ipAddress: ip
    });
  }

  static async logFailedAuth(ip: string, details: string) {
    return this.log({
      action: "UNAUTHORIZED_ACCESSS_ATTEMPT",
      entity: "GlobalGuard",
      entityId: ip,
      after: details,
      ipAddress: ip
    });
  }

  static async logJournalPosted(userId: string, entryId: string, payload: any, ip?: string) {
    return this.log({
      userId,
      action: "JOURNAL_POST",
      entity: "JournalEntry",
      entityId: entryId,
      after: JSON.stringify(payload),
      ipAddress: ip
    });
  }
}
