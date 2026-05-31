import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { EncryptionService } from '../security/encryption.service';

const router = Router();

// 8. Strict Rate Limiting specifically tuned to block brute-force/orchestrated tampering
const securityRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 60, // Limit each IP to 60 secure crypto operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
  message: {
    status: 'error',
    code: 'SEC_RATE_LIMIT_EXCEEDED',
    message: 'Cryptographic request threshold breached. Access has been temporarily restricted.'
  }
});

// Apply rate limiter to all paths under this sub-router
router.use(securityRateLimiter);

/**
 * Validator middleware for payload completeness
 */
const validateRawPayload = (req: Request, res: Response, next: NextFunction): void => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({
      status: 'error',
      code: 'SEC_BAD_INPUT',
      message: 'Body template validation error: A "text" string property is required.'
    });
    return;
  }
  next();
};

/**
 * Route 1: General Encrypt
 * Encrypts arbitrary raw text using the server-side environment master key
 */
router.post('/encrypt', validateRawPayload, (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const encrypted = EncryptionService.encrypt(text);
    return res.json({
      status: 'success',
      data: encrypted
    });
  } catch (error: any) {
    // 9. Structured Errors: Never dump system details, exceptions or raw stack traces in responses
    return res.status(500).json({
      status: 'error',
      code: 'SEC_ENCRYPT_FAILURE',
      message: 'Cryptographic core failure during encryption.'
    });
  }
});

/**
 * Route 2: General Decrypt
 * Decrypts text previously encrypted via general encrypt
 */
router.post('/decrypt', (req: Request, res: Response) => {
  try {
    const { iv, encryptedData, authTag } = req.body;
    if (!iv || !encryptedData || !authTag) {
      return res.status(400).json({
        status: 'error',
        code: 'SEC_BAD_INPUT',
        message: 'Payload template validation error: "iv", "encryptedData", and "authTag" parameters are required.'
      });
    }

    const decryptedText = EncryptionService.decrypt({ iv, encryptedData, authTag });
    return res.json({
      status: 'success',
      data: { decryptedText }
    });
  } catch (error: any) {
    return res.status(400).json({
      status: 'error',
      code: 'SEC_DECRYPT_FAILURE',
      message: 'Integrity checking failed. The payload is invalid or the security signature has expired.'
    });
  }
});

/**
 * Route 3: Encrypt Backup
 * Encrypts complex database snapshots using custom PBKDF2 stretching
 */
router.post('/encrypt-backup', validateRawPayload, (req: Request, res: Response) => {
  try {
    const { text, password } = req.body;
    const encrypted = EncryptionService.encryptBackup(text, password);
    return res.json({
      status: 'success',
      data: encrypted
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      code: 'SEC_BACKUP_ENCRYPT_FAILURE',
      message: 'Operational failure during database snapshot packaging.'
    });
  }
});

/**
 * Route 4: Decrypt Backup
 * Decrypts a stored backup structure using standard keys or user-provided passphrase
 */
router.post('/decrypt-backup', (req: Request, res: Response) => {
  try {
    const { salt, iv, encrypted_data, password } = req.body;
    if (!salt || !iv || !encrypted_data) {
      return res.status(400).json({
        status: 'error',
        code: 'SEC_BAD_INPUT',
        message: 'Payload template validation error: "salt", "iv", and "encrypted_data" parameters are required.'
      });
    }

    const decryptedText = EncryptionService.decryptBackup({ salt, iv, encrypted_data }, password);
    return res.json({
      status: 'success',
      data: { decryptedText }
    });
  } catch (error: any) {
    return res.status(400).json({
      status: 'error',
      code: 'SEC_BACKUP_DECRYPT_FAILURE',
      message: 'Authentication check failed. Invalid snapshot credentials or modified backup data detected.'
    });
  }
});

export default router;
