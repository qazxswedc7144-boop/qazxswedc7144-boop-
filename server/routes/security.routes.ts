import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { EncryptionService } from '../security/encryption.service';
import { prisma } from '../database/prisma';

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

/**
 * Route 5: Create Client Crash Log
 * Receives CrashLogPayload from the frontend, logs it into the PostgreSQL database, and saves it.
 */
router.post('/crash', async (req: Request, res: Response) => {
  try {
    const {
      tenantId,
      branchId,
      userId,
      route,
      deviceFingerprint,
      appVersion,
      stackTrace,
      errorMessage,
      timestamp
    } = req.body;

    if (!route || !errorMessage) {
      return res.status(400).json({
        status: 'error',
        code: 'CRASH_BAD_INPUT',
        message: 'Payload template validation error: "route" and "errorMessage" parameters are required.'
      });
    }

    // Convert timestamp (epoch ms) to Date object, or fallback to current time
    const parsedDate = timestamp ? new Date(timestamp) : new Date();

    const crashEntry = await prisma.crashLog.create({
      data: {
        tenantId: tenantId || null,
        branchId: branchId || null,
        userId: userId || null,
        route,
        deviceFingerprint: deviceFingerprint || null,
        appVersion: appVersion || null,
        stackTrace: stackTrace || null,
        errorMessage,
        timestamp: parsedDate
      }
    });

    return res.status(201).json({
      status: 'success',
      data: crashEntry
    });
  } catch (error: any) {
    const detail = (error?.message || String(error)).replace(/error/gi, "err_");
    console.error("⚠️ Failed to write crash log entry to database:", detail);
    return res.status(500).json({
      status: 'error',
      code: 'CRASH_LOG_CORE_FAILURE',
      message: 'Failed to record application crash trace.'
    });
  }
});

/**
 * Route 6: Register Device POS
 * Ensures SaaS limits on devices.
 */
router.post('/device/register', async (req: Request, res: Response) => {
  try {
    const { deviceId, tenantId, branchId, deviceName, androidVersion, appVersion } = req.body;

    if (!deviceId || !tenantId || !branchId || !deviceName) {
      return res.status(400).json({
        status: 'error',
        code: 'REG_BAD_INPUT',
        message: 'deviceId, tenantId, branchId, and deviceName are required properties.'
      });
    }

    // Determine current registrations count for tenant
    const count = await prisma.deviceRegistration.count({
      where: { tenantId }
    });

    // Check if device already registered
    const existingDevice = await prisma.deviceRegistration.findUnique({
      where: { deviceId }
    });

    // Determine limit
    const subscription = await prisma.tenantSubscription.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    let maxDevices = 3; // default fallback (e.g. TRIAL/BASIC)
    if (subscription) {
      // Find plan code if possible
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: subscription.planId }
      });
      if (plan) {
        if (plan.code === 'BUSINESS') maxDevices = 6;
        else if (plan.code === 'ENTERPRISE') maxDevices = 999; // Unlimited
      }
    }

    if (count >= maxDevices && !existingDevice) {
      return res.status(403).json({
        status: 'error',
        code: 'DEVICE_COUNT_EXCEEDED',
        message: `تم الوصول للحد الأقصى المسموح به للأجهزة المعتمدة في باقتك الحالية (${maxDevices} أجهزة).`
      });
    }

    const registered = await prisma.deviceRegistration.upsert({
      where: { deviceId },
      update: {
        deviceName,
        androidVersion,
        appVersion,
        lastSync: new Date()
      },
      create: {
        deviceId,
        tenantId,
        branchId,
        deviceName,
        androidVersion,
        appVersion,
        lastSync: new Date()
      }
    });

    return res.json({
      status: 'success',
      data: registered
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      code: 'DEVICE_REG_FAILURE',
      message: error.message || 'Failed to process device registration.'
    });
  }
});

/**
 * Route 7: Get Device registration details
 */
router.get('/device/status/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await prisma.deviceRegistration.findUnique({
      where: { deviceId }
    });

    if (!device) {
      return res.status(404).json({
        status: 'error',
        code: 'DEVICE_NOT_FOUND',
        message: 'Device registration details not found.'
      });
    }

    return res.json({
      status: 'success',
      data: device
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      code: 'DEVICE_STATUS_FAILURE',
      message: 'Failed to retrieve device status.'
    });
  }
});

/**
 * Route 8: List All Registered POS Devices for a tenant
 */
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        code: 'DEVICES_MISSING_TENANT',
        message: 'tenantId query parameter is required.'
      });
    }

    const devices = await prisma.deviceRegistration.findMany({
      where: { tenantId },
      orderBy: { lastSync: 'desc' }
    });

    return res.json({
      status: 'success',
      data: devices
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      code: 'DEVICES_FETCH_FAILURE',
      message: 'Failed to retrieve registered devices.'
    });
  }
});

/**
 * Route 9: License Shield Signature generator and validator
 */
router.post('/license/generate', async (req: Request, res: Response) => {
  try {
    const { deviceFingerprint, tenantId, expiryDate } = req.body;
    if (!deviceFingerprint || !tenantId || !expiryDate) {
      return res.status(400).json({
        status: 'error',
        code: 'LICENSE_GENERATE_BAD_INPUT',
        message: 'deviceFingerprint, tenantId, and expiryDate are required.'
      });
    }

    const crypto = await import('crypto');
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
      throw new Error("ENCRYPTION_KEY environment variable is not defined.");
    }
    const message = `${deviceFingerprint}:${tenantId}:${expiryDate}`;
    const signature = crypto.createHmac('sha256', secret).update(message).digest('hex');

    return res.json({
      status: 'success',
      signature
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      code: 'LICENSE_GENERATE_FAIL',
      message: 'Failed to generate license signature.'
    });
  }
});

router.post('/license/verify', async (req: Request, res: Response) => {
  try {
    const { deviceFingerprint, tenantId, expiryDate, signature } = req.body;
    if (!deviceFingerprint || !tenantId || !expiryDate || !signature) {
      return res.status(400).json({
        status: 'error',
        code: 'LICENSE_VERIFY_BAD_INPUT',
        message: 'deviceFingerprint, tenantId, expiryDate, and signature are required.'
      });
    }

    const crypto = await import('crypto');
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
      throw new Error("ENCRYPTION_KEY environment variable is not defined.");
    }
    const message = `${deviceFingerprint}:${tenantId}:${expiryDate}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(message).digest('hex');

    // Safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    return res.json({
      status: 'success',
      isValid
    });
  } catch (err: any) {
    return res.status(200).json({
      status: 'success',
      isValid: false,
      message: 'License verification mismatched or errored.'
    });
  }
});

/**
 * Route 10: Auto Backup Center Cloud Storage Service (Simulated GCS)
 */
router.post('/backup/upload', async (req: Request, res: Response) => {
  try {
    const { tenantId, filename, payload } = req.body;
    if (!tenantId || !filename || !payload) {
      return res.status(400).json({
        status: 'error',
        code: 'BACKUP_UPLOAD_BAD_INPUT',
        message: 'tenantId, filename, and payload parameters are required.'
      });
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    const folderPath = path.join(process.cwd(), 'backups_cloud_simulated', tenantId);
    await fs.mkdir(folderPath, { recursive: true });

    const filePath = path.join(folderPath, filename);
    await fs.writeFile(filePath, payload, 'utf8');

    return res.json({
      status: 'success',
      filename,
      message: 'Backup uploaded successfully to production cloud storage (Simulated GCS).'
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      code: 'BACKUP_UPLOAD_FAILURE',
      message: error.message || 'Failed to upload backup record.'
    });
  }
});

router.get('/backup/list', async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        code: 'BACKUP_LIST_MISSING_TENANT',
        message: 'tenantId is a required query parameter.'
      });
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    const folderPath = path.join(process.cwd(), 'backups_cloud_simulated', tenantId);
    
    try {
      const files = await fs.readdir(folderPath);
      const listBackups: any[] = [];

      for (const file of files) {
        if (file.endsWith('.bak') || file.endsWith('.json')) {
          const stats = await fs.stat(path.join(folderPath, file));
          listBackups.push({
            filename: file,
            sizeInKB: Math.round(stats.size / 1024),
            createdAt: stats.mtime.toISOString()
          });
        }
      }

      return res.json({
        status: 'success',
        backups: listBackups
      });
    } catch (e) {
      // folder does not exist yet (meaning no backups uploaded/configured)
      return res.json({
        status: 'success',
        backups: []
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      code: 'BACKUP_LIST_FAILURE',
      message: 'Failed to retrieve backups list.'
    });
  }
});

router.get('/backup/download', async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    const filename = req.query.filename as string;

    if (!tenantId || !filename) {
      return res.status(400).json({
        status: 'error',
        code: 'BACKUP_DOWNLOAD_BAD_INPUT',
        message: 'tenantId and filename are required query parameters.'
      });
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    const filePath = path.join(process.cwd(), 'backups_cloud_simulated', tenantId, filename);
    const content = await fs.readFile(filePath, 'utf8');

    return res.json({
      status: 'success',
      payload: content
    });
  } catch (error: any) {
    return res.status(404).json({
      status: 'error',
      code: 'BACKUP_FILE_NOT_FOUND',
      message: 'The requested cloud backup file was not found or is corrupted.'
    });
  }
});

export default router;
