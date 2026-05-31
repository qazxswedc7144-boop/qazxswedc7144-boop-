export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToUint8Array(hexString: string): Uint8Array {
  const cleanHex = hexString.replace(/[^0-9a-fA-F]/g, '');
  const length = cleanHex.length / 2;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Client-Side Encryption Proxy Service.
 * Delegate all cryptographic heavy-lifting to the secure backend to prevent key exposure in browser DevTools.
 */
export class EncryptionService {
  /**
   * Sends the cleartext to the backend secure encryption proxy
   */
  static async encryptBackup(data: any, password?: string): Promise<{ salt: string; iv: string; encrypted_data: string; version: string }> {
    const jsonText = typeof data === 'string' ? data : JSON.stringify(data);

    try {
      const response = await fetch('/api/security/encrypt-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: jsonText, password }),
      });

      const result = await response.json();
      if (!response.ok || result.status === 'error') {
        throw new Error(result.message || 'Error occurred during backend backup encryption.');
      }

      return result.data; // Matches { salt, iv, encrypted_data, version }
    } catch (e: any) {
      console.error('Backend-driven backup encryption failed:', e);
      throw new Error(`ENCRYPTION_FAILED: ${e.message || String(e)}`);
    }
  }

  /**
   * Sends the encrypted payload to the backend secure decryption proxy
   */
  static async decryptBackup(encryptedObj: any, password?: string): Promise<any> {
    try {
      const parsedObj = typeof encryptedObj === 'string' ? JSON.parse(encryptedObj) : encryptedObj;
      if (!parsedObj.salt || !parsedObj.iv || !parsedObj.encrypted_data) {
        throw new Error('DECRYPTION_FAILED: Missing cryptographic payload parameters (salt/iv/encrypted_data).');
      }

      const response = await fetch('/api/security/decrypt-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          salt: parsedObj.salt,
          iv: parsedObj.iv,
          encrypted_data: parsedObj.encrypted_data,
          password,
        }),
      });

      const result = await response.json();
      if (!response.ok || result.status === 'error') {
        throw new Error(result.message || 'Error occurred during backend backup decryption.');
      }

      const jsonText = result.data.decryptedText;
      return JSON.parse(jsonText);
    } catch (e: any) {
      console.error('Backend-driven backup decryption failed:', e);
      throw new Error(`DECRYPTION_FAILED: ${e.message || String(e)}`);
    }
  }

  /**
   * Simple non-secret text formatting left compatible with other subsystems.
   */
  static encrypt(data: string, key?: string): string {
    return 'SEC:' + uint8ArrayToHex(new TextEncoder().encode(data)) + '::K:' + uint8ArrayToHex(new TextEncoder().encode(key || ''));
  }

  static decrypt(encryptedData: string, _key?: string): string {
    if (!encryptedData.startsWith('SEC:')) {
      return encryptedData;
    }
    try {
      const parts = encryptedData.split('::K:');
      const dataHex = (parts[0] || '').replace('SEC:', '');
      return new TextDecoder().decode(hexToUint8Array(dataHex));
    } catch (e) {
      return encryptedData;
    }
  }
}
