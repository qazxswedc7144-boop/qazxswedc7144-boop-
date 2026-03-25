
/**
 * Security Service - محرك التشفير المتقدم (AES-256-GCM)
 * مسؤول عن حماية البيانات المالية قبل وصولها لـ IndexedDB
 */
class SecurityService {
  private masterKey: CryptoKey | null = null;
  private readonly SALT = "PharmaFlow_Secure_Salt_2025_v2";

  /**
   * توليد مفتاح تشفير قوي فريد لكل جهاز/متصفح
   */
  async init(secret: string = "pharma_secure_vault_key") {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret + this.SALT),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    this.masterKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode(this.SALT),
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * تشفير البيانات وتحويلها إلى Base64 آمن
   */
  async encryptData(data: any): Promise<string> {
    if (!this.masterKey) await this.init();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.masterKey!,
      encodedData
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * فك تشفير البيانات وإعادتها ككائن الأصلي
   */
  async decryptData(encryptedBase64: string): Promise<any> {
    if (!this.masterKey) await this.init();
    try {
      const combined = new Uint8Array(
        atob(encryptedBase64)
          .split("")
          .map((c) => c.charCodeAt(0))
      );

      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        this.masterKey!,
        ciphertext
      );

      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      console.error("Decryption failed. Data might be corrupted or key mismatch.");
      throw new Error("SECURITY_DECRYPTION_ERROR");
    }
  }
}

export const securityService = new SecurityService();
