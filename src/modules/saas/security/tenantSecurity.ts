import CryptoJS from 'crypto-js';

export interface TenantConfig {
  tenantId: string;
  name: string;
  encryptionKey: string;
  isolationMode: 'LOGICAL' | 'PHYSICAL_SCHEMA' | 'HYBRID_VAULT';
  status: 'ACTIVE' | 'SUSPENDED' | 'MAINTENANCE';
  createdAt: string;
}

export class TenantSecurityService {
  private static defaultKey = "pf-enterprise-secure-key-2026-v207";

  /**
   * Generates a unique, high-entropy 256-bit AES encryption key for a tenant.
   */
  static generateTenantKey(tenantId: string): string {
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const key = CryptoJS.PBKDF2(this.defaultKey, salt + tenantId, {
      keySize: 256 / 32,
      iterations: 1000
    });
    return key.toString(CryptoJS.enc.Base64);
  }

  /**
   * Encrypts a payload for secure cloud sync transmission.
   */
  static encryptPayload(payload: any, key: string): string {
    try {
      const plaintext = JSON.stringify(payload);
      const encrypted = CryptoJS.AES.encrypt(plaintext, key);
      return encrypted.toString();
    } catch (err) {
      console.error("Encryption failure:", err);
      throw new Error("Failed to encrypt tenant dataset payload.");
    }
  }

  /**
   * Decrypts an incoming sync payload.
   */
  static decryptPayload(cipherText: string, key: string): any {
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, key);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedText);
    } catch (err) {
      console.error("Decryption failure:", err);
      throw new Error("Failed to decrypt tenant database payload: Integrity constraint violated or wrong signature.");
    }
  }

  /**
   * Validates if a record belongs to the active tenant.
   * This is used as a run-time soft-isolation check before syncing or displaying documents.
   */
  static assertTenantIsolation(record: any, activeTenantId: string): boolean {
    if (!record) return true;
    
    // Fallback: If no tenant ID is present on old records, assume isolation is logical for migration
    const recordTenantId = record.tenantId || record.TenantId || 'TEN_MAIN_MAIN';
    if (recordTenantId !== activeTenantId) {
      console.error(`ISOLATION BREACH PREVENTED: Record tenantId (${recordTenantId}) does not match Session tenantId (${activeTenantId})`);
      return false;
    }
    return true;
  }

  /**
   * Generates a SHA-256 integrity hash of a dataset row to guarantee tamper-proof ledger entries.
   */
  static calculateLedgerChecksum(item: any, tenantId: string): string {
    const contextStr = `${tenantId}-${item.id || ''}-${JSON.stringify(item)}`;
    return CryptoJS.SHA256(contextStr).toString();
  }
}
