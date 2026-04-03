
/**
 * EncryptionService - Secure Encryption Engine using Web Crypto API
 * Implements AES-GCM with PBKDF2 key derivation.
 */
export class EncryptionService {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly PBKDF2_ITERATIONS = 100000;
  private static readonly SALT_LENGTH = 16;
  private static readonly IV_LENGTH = 12;

  /**
   * Derives an AES-GCM key from a password and salt using PBKDF2.
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts plain data (JSON) using a password.
   */
  static async encrypt(data: any, password: string): Promise<{ iv: string; salt: string; encrypted_data: string }> {
    const encoder = new TextEncoder();
    const plainText = typeof data === 'string' ? data : JSON.stringify(data);
    const plainTextBuffer = encoder.encode(plainText);

    const salt = window.crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
    const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    const key = await this.deriveKey(password, salt);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
      },
      key,
      plainTextBuffer
    );

    return {
      iv: this.bufToHex(iv),
      salt: this.bufToHex(salt),
      encrypted_data: this.bufToHex(new Uint8Array(encryptedBuffer)),
    };
  }

  /**
   * Decrypts an encrypted object using a password.
   */
  static async decrypt(encryptedObj: { iv: string; salt: string; encrypted_data: string }, password: string): Promise<any> {
    const iv = this.hexToBuf(encryptedObj.iv);
    const salt = this.hexToBuf(encryptedObj.salt);
    const encryptedData = this.hexToBuf(encryptedObj.encrypted_data);
    const key = await this.deriveKey(password, salt);

    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      const plainText = decoder.decode(decryptedBuffer);
      
      try {
        return JSON.parse(plainText);
      } catch {
        return plainText;
      }
    } catch (error) {
      throw new Error('DECRYPTION_FAILED: Invalid password or corrupted data.');
    }
  }

  private static bufToHex(buffer: Uint8Array): string {
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private static hexToBuf(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }
}
