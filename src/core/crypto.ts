
export class CryptoEngine {
  private static ALGORITHM = 'AES-GCM';
  private static KEY_LENGTH = 256;

  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static async encrypt(data: string, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv },
      key,
      encoder.encode(data)
    );

    return { ciphertext, iv };
  }

  static async decrypt(ciphertext: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      { name: this.ALGORITHM, iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  static async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
