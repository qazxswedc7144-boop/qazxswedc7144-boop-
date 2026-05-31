import crypto from 'crypto';

export function getEncryptionKeyBuffer(): Buffer {
  const key = process.env.ENCRYPTION_KEY || 'pharmaflow-fallback-secure-master-key-gcm-sha256-2026';
  // Standard AES-256 requires exactly a 32-byte (256-bit) key.
  // Hashing guarantees it's always exactly 32 bytes and prevents invalid length crashes.
  return crypto.createHash('sha256').update(key).digest();
}

export interface EncryptedPayload {
  iv: string;
  encryptedData: string;
  authTag: string;
}

export interface BackupEncryptedPayload {
  salt: string;
  iv: string;
  encrypted_data: string;
  version: string;
}

/**
 * Enterprise Application Security Service
 * Performs secure, server-side encryption/decryption using AES-256-GCM.
 */
export const EncryptionService = {
  /**
   * Encrypts direct strings using the server's private key
   */
  encrypt(text: string): EncryptedPayload {
    try {
      const keyBuffer = getEncryptionKeyBuffer();
      const iv = crypto.randomBytes(12); // Recommendation for AES-GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag().toString('hex');
      
      return {
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        authTag: authTag,
      };
    } catch (error: any) {
      throw new Error(`ENCRYPTION_ENGINE_FAILURE: Secure cryptographic packaging failed.`);
    }
  },

  /**
   * Decrypts direct strings using the server's private key
   */
  decrypt(payload: EncryptedPayload): string {
    try {
      if (!payload.iv || !payload.encryptedData || !payload.authTag) {
        throw new Error('DECRYPTION_BAD_INPUT: Missing GCM inputs.');
      }

      const keyBuffer = getEncryptionKeyBuffer();
      const ivBuffer = Buffer.from(payload.iv, 'hex');
      const authTagBuffer = Buffer.from(payload.authTag, 'hex');
      const encryptedBuffer = Buffer.from(payload.encryptedData, 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
      decipher.setAuthTag(authTagBuffer);
      
      let decrypted = decipher.update(encryptedBuffer);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error: any) {
      // 9. Protect administrative tracebacks: Never bubble sensitive low-level keys or deep system faults to clients
      throw new Error('CRYPTOGRAPHIC_FAILURE: Intercepted decrypt payload corruption or validation stamp mismatch.');
    }
  },

  /**
   * Encrypts backup snapshot strings using PBKDF2 keys derived from custom user passwords or server fallback key
   */
  encryptBackup(text: string, password?: string): BackupEncryptedPayload {
    try {
      // Generate secure salt (16 bytes) and IV (12 bytes)
      const salt = crypto.randomBytes(16);
      const iv = crypto.randomBytes(12);

      // Determine stretching secret
      const stretchingPassphrase = password || process.env.ENCRYPTION_KEY || 'PharmaFlow_SECURE_Default_System_Backup_Key_AES_GCM_GZIP';
      
      // Derive 256-bit AES key via secure PBKDF2 stretching
      const derivedKey = crypto.pbkdf2Sync(
        stretchingPassphrase,
        salt,
        100000, // Matching Frontend 100K iterations
        32,     // 256 bits (32 bytes)
        'sha256'
      );

      const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');

      // In the original browser-side system, the encrypted_data field contained the ciphertext + authTag packed together,
      // or window.crypto.subtle.encrypt appended it automatically at the end!
      // In WebCrypto subtles, subtle.encrypt returns a combined ciphertext + 16-byte GCM authentication tag.
      // So to maintain EXACT format compatibility for restore snapshot storage:
      // WebCrypto subtle.encrypt = Node's cipher.update + final AND THEN appended with the authTag!
      const encryptedBuffer = Buffer.from(encrypted, 'hex');
      const authTagBuffer = Buffer.from(authTag, 'hex');
      const combinedBuffer = Buffer.concat([encryptedBuffer, authTagBuffer]);

      return {
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        encrypted_data: combinedBuffer.toString('hex'),
        version: '1.0-AES-GCM-GZIP'
      };
    } catch (error: any) {
      throw new Error(`BACKUP_ENCRYPTION_ERR: Operational halt inside cryptographic backup pipeline.`);
    }
  },

  /**
   * Decrypts backup snapshot objects and returns raw JSON text
   */
  decryptBackup(payload: Omit<BackupEncryptedPayload, 'version'>, password?: string): string {
    const saltBuffer = Buffer.from(payload.salt, 'hex');
    const ivBuffer = Buffer.from(payload.iv, 'hex');
    const combinedBuffer = Buffer.from(payload.encrypted_data, 'hex');

    if (combinedBuffer.length < 16) {
      throw new Error(`BACKUP_DECRYPTION_ERR: Payload is too short to contain a valid GCM authentication tag. Length: ${combinedBuffer.length}`);
    }

    // WebCrypto subtle.encrypt appended the 16-byte auth tag at the end of the encrypted buffer.
    // So we must split the combined buffer into:
    // - Encrypted ciphertext: everything except the last 16 bytes
    // - Auth tag: the last 16 bytes
    const ciphertextBuffer = combinedBuffer.subarray(0, combinedBuffer.length - 16);
    const authTagBuffer = combinedBuffer.subarray(combinedBuffer.length - 16);

    // Collect all candidate keys for high-integrity key rotation and environment fallback safety
    const rawCandidates: string[] = [];
    if (password) {
      rawCandidates.push(password);
    }
    if (process.env.ENCRYPTION_KEY) {
      rawCandidates.push(process.env.ENCRYPTION_KEY);
    }
    
    // Push all standard/fallback key materials used in production or local environments
    rawCandidates.push('PharmaFlow_SECURE_Default_System_Backup_Key_AES_GCM_GZIP');
    rawCandidates.push('pharmaflow-fallback-secure-master-key-gcm-sha256-2026');
    rawCandidates.push('replace_with_32_byte_secure_key');
    rawCandidates.push('pharmaflow-local-key');
    rawCandidates.push('default_backup_password');
    rawCandidates.push('PharmaFlow_SECURE_Default_System_Backup_Key');
    rawCandidates.push('pharmaflow-fallback-secure-master-key-gcm-sha256');
    rawCandidates.push('PharmaFlow_SECURE');
    rawCandidates.push('pharmaflow');
    rawCandidates.push('system');
    rawCandidates.push('undefined');
    rawCandidates.push('null');
    rawCandidates.push('');

    // Ensure uniqueness, remove falsy values or invalid types
    const candidates = Array.from(new Set(rawCandidates.filter(k => typeof k === 'string' && k !== '')));

    // Build exhaustive list of potential derived and direct key buffers to try
    const keysToTry: { label: string; key: Buffer }[] = [];

    for (const key of candidates) {
      // 1. Pbkdf2 Sync stretch (100k, sha256)
      try {
        const derivedKey = crypto.pbkdf2Sync(
          key,
          saltBuffer,
          100000,
          32,
          'sha256'
        );
        keysToTry.push({ label: `pbkdf2Sync of ${key.substring(0, 10)}...`, key: derivedKey });
      } catch (e) {}

      // 2. Direct SHA256 hashed Buffer
      try {
        const shaKey = crypto.createHash('sha256').update(key).digest();
        keysToTry.push({ label: `sha256 of ${key.substring(0, 10)}...`, key: shaKey });
      } catch (e) {}

      // 3. Raw Padded/Truncated 32-byte Buffer
      try {
        const padded = Buffer.alloc(32);
        padded.write(key, 0, Math.min(32, Buffer.byteLength(key)), 'utf8');
        keysToTry.push({ label: `padded Buffer of ${key.substring(0, 10)}...`, key: padded });
      } catch (e) {}

      // 4. Raw key if exactly 32 bytes
      try {
        const rawBuf = Buffer.from(key, 'utf8');
        if (rawBuf.length === 32) {
          keysToTry.push({ label: `exact 32B Buffer of ${key.substring(0, 10)}...`, key: rawBuf });
        }
      } catch (e) {}
    }

    let lastError: any = null;
    for (const item of keysToTry) {
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', item.key, ivBuffer);
        decipher.setAuthTag(authTagBuffer);

        let decrypted = decipher.update(ciphertextBuffer);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
      } catch (err: any) {
        lastError = err;
      }
    }

    console.error(`[EncryptionService] Backup decryption failed across ${keysToTry.length} key attempts. Last error:`, lastError?.message || lastError);
    throw new Error(`BACKUP_DECRYPTION_ERR: Integrity validation failed. Incorrect password, modified backup, or key rotation mismatch. Details: ${lastError ? lastError.message : 'Unknown'}`);
  }
};
