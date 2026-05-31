import { db } from '@/core/db';
import { authService } from '@/modules/auth/services/authService';
import { SystemBackup, AuditLogEntry } from '@/types';
import { EncryptionService, hexToUint8Array, uint8ArrayToHex } from '@/services/security/EncryptionService';
import { IntegritySweepService } from '@/services/integrity/IntegritySweepService';

/**
 * Packs cryptographic elements cleanly into a 100% binary container (No Base64 format!)
 * Format:
 * [Magic Code: "PFBACKUP" (8B)]
 * [Header Version: Major (1B), Minor (0B)]
 * [Lengths: Salt Length (4B), IV Length (4B), Encrypted Length (4B)]
 * [Salt Payload]
 * [IV Payload]
 * [AES-GCM Encrypted Gzip Data Payload]
 */
export function writeBinaryContainer(salt: Uint8Array, iv: Uint8Array, encryptedData: Uint8Array): Uint8Array {
  const magic = new TextEncoder().encode("PFBACKUP"); // 8 bytes
  const headerVersion = new Uint8Array([1, 0]); // 2 bytes
  
  const lengths = new ArrayBuffer(12);
  const dv = new DataView(lengths);
  dv.setUint32(0, salt.length, false); // Big-Endian
  dv.setUint32(4, iv.length, false);
  dv.setUint32(8, encryptedData.length, false);
  
  const totalLength = 8 + 2 + 12 + salt.length + iv.length + encryptedData.length;
  const container = new Uint8Array(totalLength);
  
  container.set(magic, 0);
  container.set(headerVersion, 8);
  container.set(new Uint8Array(lengths), 10);
  
  let offset = 22;
  container.set(salt, offset);
  offset += salt.length;
  container.set(iv, offset);
  offset += iv.length;
  container.set(encryptedData, offset);
  
  return container;
}

/**
 * Parses and verifies raw binary container elements
 */
export function readBinaryContainer(containerBytes: Uint8Array): { salt: Uint8Array; iv: Uint8Array; encryptedData: Uint8Array; version: string } {
  if (containerBytes.length < 22) {
    throw new Error("RESTORE_FAILED: Backup file size is too small or layout is corrupted.");
  }

  const magic = new TextDecoder().decode(containerBytes.subarray(0, 8));
  if (magic !== "PFBACKUP") {
    throw new Error("RESTORE_FAILED: Invalid backup container format (Magic header mismatch).");
  }
  const major = containerBytes[8];
  const minor = containerBytes[9];
  
  const lengthsBytes = containerBytes.slice(10, 22);
  const dv = new DataView(lengthsBytes.buffer);
  const saltLen = dv.getUint32(0, false);
  const ivLen = dv.getUint32(4, false);
  const encLen = dv.getUint32(8, false);
  
  if (containerBytes.length < 22 + saltLen + ivLen + encLen) {
    throw new Error("RESTORE_FAILED: Cryptographic binary sections are truncated or corrupted.");
  }

  const salt = containerBytes.subarray(22, 22 + saltLen);
  const iv = containerBytes.subarray(22 + saltLen, 22 + saltLen + ivLen);
  const encryptedData = containerBytes.subarray(22 + saltLen + ivLen, 22 + saltLen + ivLen + encLen);
  
  return {
    salt,
    iv,
    encryptedData,
    version: `${major}.${minor}`
  };
}

export const BackupService = {
  /**
   * PHASE 2 — SNAPSHOT ENGINE
   * Encrypts and GZIP-compresses a detailed snapshot of the database tables
   */
  async createBackup(name: string, type: SystemBackup['backupType'], isIncremental = false, password?: string): Promise<string> {
    const user = authService.getCurrentUser();
    const now = new Date().toISOString();
    const backupId = db.generateId('BK');

    try {
      let snapshot: any = {};
      let parentBackupId: string | undefined;

      if (isIncremental) {
        const lastBackup = await db.db.systemBackups.orderBy('createdAt').reverse().first();
        if (lastBackup) {
          parentBackupId = lastBackup.id;
          snapshot = await this.collectIncrementalSnapshot(lastBackup.createdAt);
        } else {
          snapshot = await this.collectFullSnapshot();
          isIncremental = false;
        }
      } else {
        snapshot = await this.collectFullSnapshot();
      }

      const jsonSnapshot = JSON.stringify(snapshot);
      
      // PHASE 8 — BACKUP ENCRYPTION (AES-GCM, PBKDF2 stretching with custom user password or system key on backend)
      const encryptionPassword = password || undefined;
      const encrypted = await EncryptionService.encryptBackup(jsonSnapshot, encryptionPassword);
      
      const compressedSizeInBytes = hexToUint8Array(encrypted.encrypted_data).length;
      const sizeInKB = Math.round(compressedSizeInBytes / 1024) || 1;

      const backupRecord: SystemBackup = {
        id: backupId,
        backupName: name,
        backupType: type,
        createdAt: now,
        createdBy: user?.User_Email || 'SYSTEM',
        systemVersion: '2.5.0-ENTERPRISE',
        dataSnapshot: JSON.stringify(encrypted), // Stored as non-base64 HEX values within structure
        checksumHash: encrypted.salt + encrypted.iv, // Use cryptographic combination of salt & iv for database quick validation
        sizeInKB: sizeInKB,
        status: 'SUCCESS',
        restoreTested: false,
        isIncremental,
        parentBackupId
      };

      await db.db.systemBackups.add(backupRecord);
      
      // PHASE 4 — Cleanup old backups
      await this.cleanupOldBackups();

      return backupId;
    } catch (error) {
      console.error('Backup creation failed:', error);
      const failedRecord: any = {
        id: backupId,
        backupName: name,
        backupType: type,
        createdAt: now,
        createdBy: user?.User_Email || 'SYSTEM',
        systemVersion: '2.5.0-ENTERPRISE',
        dataSnapshot: '',
        checksumHash: '',
        sizeInKB: 0,
        status: 'FAILED',
        restoreTested: false
      };
      await db.db.systemBackups.add(failedRecord);
      throw error;
    }
  },

  getDeviceId(): string {
    let deviceId = localStorage.getItem('erp_device_id');
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('erp_device_id', deviceId);
    }
    return deviceId;
  },

  /**
   * COLLECTS DATABASE
   */
  async exportDatabase(): Promise<any> {
    const tables: any = {};
    const tableNames = typeof db.getExistingTableNames === 'function' ? db.getExistingTableNames() : db.db.tables.map(t => t.name);
    
    for (const name of tableNames) {
      tables[name] = await (db.db as any)[name].toArray();
    }

    return {
      version: "1.0",
      timestamp: Date.now(),
      updatedAt: Date.now(),
      device_id: this.getDeviceId(),
      tables
    };
  },

  /**
   * EXPORTS RAW AES-GCM ENCRYPTED GZIP BINARY backup file (Strictly No Base64!)
   */
  async exportBackupToFile(password: string): Promise<Blob> {
    const data = await this.exportDatabase();
    
    // Encrypt handles compression first, then secure 256-bit AES-GCM encryption
    const encrypted = await EncryptionService.encryptBackup(data, password);
    
    const saltBytes = hexToUint8Array(encrypted.salt);
    const ivBytes = hexToUint8Array(encrypted.iv);
    const encryptedBytes = hexToUint8Array(encrypted.encrypted_data);
    
    // Packs components cleanly into raw binary format
    const binaryBytes = writeBinaryContainer(saltBytes, ivBytes, encryptedBytes);
    return new Blob([binaryBytes], { type: 'application/octet-stream' });
  },

  /**
   * RESTORE ENTRY POINT WITH AUTOMATED TRANSACTIONAL ROLLBACK SECURITY
   */
  async restoreBackup(file: File | Blob, password: string): Promise<void> {
    // 1. Gather a complete database snapshot image before any mutation to enable rollback state recovery
    const rollbackSnapshot = await this.collectFullSnapshot();
    
    try {
      const arrayBuffer = await (file instanceof File ? file.arrayBuffer() : new Response(file).arrayBuffer());
      const containerBytes = new Uint8Array(arrayBuffer);
      
      let decryptedData: any;
      
      // Magic-byte identification matching
      const signature = new TextDecoder().decode(containerBytes.subarray(0, 8));
      if (signature === "PFBACKUP") {
        const parsed = readBinaryContainer(containerBytes);
        decryptedData = await EncryptionService.decryptBackup({
          salt: uint8ArrayToHex(parsed.salt),
          iv: uint8ArrayToHex(parsed.iv),
          encrypted_data: uint8ArrayToHex(parsed.encryptedData)
        }, password);
      } else {
        // Formatted fallback or legacy fallback if required
        const text = new TextDecoder().decode(containerBytes);
        const encryptedObj = JSON.parse(text);
        decryptedData = await EncryptionService.decryptBackup(encryptedObj, password);
      }
      
      if (!decryptedData || typeof decryptedData !== 'object') {
        throw new Error('RESTORE_FAILED: Decrypted snapshot is empty or unusable.');
      }

      // 2. Clear current database table schemas
      await this.clearAllTables();

      // 3. Bulk populate
      const tablesSource = decryptedData.tables || decryptedData;
      await this.restoreTables(tablesSource);

      // 4. Run post-restore enterprise data validation
      await this.validateRestoredData();

      // Recalculate system references & audit logging
      await this.rebuildSystemState();
      await db.addAuditLog('RESTORE', 'SYSTEM', 'EXTERNAL', `System safely restored from external binary backup file`);

    } catch (error: any) {
      console.error("Critical Restore Error! Activating safety state rollback...", error);
      
      // REBOOT / ROLLBACK STATE PROCESS
      try {
        await this.clearAllTables();
        await this.restoreTables(rollbackSnapshot);
        await this.rebuildSystemState();
      } catch (rollbackError) {
        console.error("Rollback execution error! System dataset might need deep reset.", rollbackError);
      }

      if (error.message.includes('DECRYPTION_FAILED') || error.message.includes('decryption')) {
        throw new Error("عذراً، كلمة مرور فك التشفير غير صحيحة أو البيانات تعرضت للتلف.");
      }
      throw new Error(`فشلت محاولة استيراد النسخة الاحتياطية لعدم اجتياز شروط السلامة. تم التراجع عن الخطوة تلقائياً: ${error.message || String(error)}`);
    }
  },

  async clearAllTables() {
    const tables = typeof db.getExistingTableNames === 'function' ? db.getExistingTableNames() : db.db.tables.map(t => t.name);
    for (const table of tables) {
      await (db.db as any)[table].clear();
    }
  },

  async restoreTables(tables: any) {
    for (const tableName in tables) {
      if ((db.db as any)[tableName] && Array.isArray(tables[tableName])) {
        await (db.db as any)[tableName].bulkPut(tables[tableName]);
      }
    }
  },

  /**
   * ENTERPRISE HEALTH & DATA HARMONIZATION VALIDATOR
   */
  async validateRestoredData() {
    console.log("Safeguard checking restored transactional balances & master schema links...");
    
    // Validate table existence
    const invoices = await db.db.invoices.toArray();
    const sales = await db.db.sales.toArray();
    const purchases = await db.db.purchases.toArray();
    
    const linkedInvoices = invoices.filter(inv => 
      sales.some(s => s.id === inv.id) || purchases.some(p => p.id === inv.id)
    );
    
    if (invoices.length > 0 && linkedInvoices.length === 0) {
      console.warn("Validation Warning: No coherent invoice ties linked back to sales ledger.");
    }

    // Validate quantities
    const products = await db.db.products.toArray();
    const invalidStock = products.filter(p => p.StockQuantity === undefined || isNaN(p.StockQuantity) || p.StockQuantity < 0);
    if (invalidStock.length > 0) {
      console.warn("Stock Alert: Certain product listings indicate negative unit storage levels.");
    }

    // Financial double-entry bookkeeping credit-debit matching rule
    const journalEntries = await db.db.journalEntries.toArray();
    let totalDebit = 0;
    let totalCredit = 0;
    journalEntries.forEach(entry => {
      if (entry.lines && Array.isArray(entry.lines)) {
        entry.lines.forEach(line => {
          totalDebit += Number(line.debit || 0);
          totalCredit += Number(line.credit || 0);
        });
      }
    });

    if (Math.abs(totalDebit - totalCredit) > 0.1) {
      throw new Error('BALANCE_Imbalance: Accounting entries total imbalance detected (Debit != Credit). RESTORE REJECTED.');
    }

    console.log("Restoration dataset integrity verification complete. All green.");
  },

  async collectFullSnapshot() {
    const existing = typeof db.getExistingTableNames === 'function' ? db.getExistingTableNames() : [];
    
    const getSafeData = async (tableName: string) => {
      if (existing.length > 0 && !existing.includes(tableName)) return [];
      const table = (db.db as any)[tableName];
      return table ? await table.toArray() : [];
    };

    return {
      sales: await getSafeData('sales'),
      purchases: await getSafeData('purchases'),
      journalEntries: await getSafeData('journalEntries'),
      inventoryTransactions: await getSafeData('inventoryTransactions'),
      customers: await getSafeData('customers'),
      suppliers: await getSafeData('suppliers'),
      products: await getSafeData('products'),
      financialTransactions: await getSafeData('financialTransactions'),
      voucherInvoiceLinks: await getSafeData('voucherInvoiceLinks'),
      settlements: await getSafeData('settlements'),
      audit_log: await getSafeData('Audit_Log'),
      accounts: await getSafeData('accounts'),
      warehouseStock: await getSafeData('warehouseStock')
    };
  },

  async collectIncrementalSnapshot(since: string) {
    const filterSince = (item: any) => (item.lastModified || item.timestamp || item.TransactionDate || item.date || item.Modified_At) > since;
    const existing = typeof db.getExistingTableNames === 'function' ? db.getExistingTableNames() : [];
    
    const getSafeData = async (tableName: string) => {
      if (existing.length > 0 && !existing.includes(tableName)) return [];
      const table = (db.db as any)[tableName];
      return table ? await table.toArray() : [];
    };

    return {
      sales: (await getSafeData('sales')).filter(filterSince),
      purchases: (await getSafeData('purchases')).filter(filterSince),
      journalEntries: (await getSafeData('journalEntries')).filter(filterSince),
      inventoryTransactions: (await getSafeData('inventoryTransactions')).filter(filterSince),
      customers: (await getSafeData('customers')).filter(filterSince),
      suppliers: (await getSafeData('suppliers')).filter(filterSince),
      products: (await getSafeData('products')).filter(filterSince),
      financialTransactions: (await getSafeData('financialTransactions')).filter(filterSince),
      voucherInvoiceLinks: (await getSafeData('voucherInvoiceLinks')).filter(filterSince),
      settlements: (await getSafeData('settlements')).filter(filterSince),
      audit_log: (await getSafeData('Audit_Log')).filter(filterSince),
      warehouseStock: (await getSafeData('warehouseStock')).filter(filterSince)
    };
  },

  /**
   * DATABASE SNAPSHOT RESTORATION WITH AUTO-ROLLBACK PROTECTION
   */
  async restoreFromBackup(backupId: string, password?: string): Promise<void> {
    const user = authService.getCurrentUser();
    if (user?.Role !== 'Admin') {
      throw new Error('RESTORE_DENIED: Only administrators can perform system restore operations.');
    }

    const backup = await db.db.systemBackups.get(backupId);
    if (!backup || backup.status !== 'SUCCESS') {
      throw new Error('RESTORE_FAILED: Selected backup snapshot is missing or invalid.');
    }

    const rollbackSnapshot = await this.collectFullSnapshot();

    try {
      let snapshot: any;
      const encryptionPassword = password || undefined;

      const encryptedObj = JSON.parse(backup.dataSnapshot);
      snapshot = await EncryptionService.decryptBackup(encryptedObj, encryptionPassword);

      if (!snapshot || typeof snapshot !== 'object') {
        throw new Error('RESTORE_FAILED: Empty snapshot schema data decrypted.');
      }

      await this.performRestore(snapshot, backup.backupName, backup.id, backup.isIncremental);

      backup.restoreTested = true;
      await db.db.systemBackups.put(backup);

    } catch (e: any) {
      console.error("Internal snapshot restore failed! Initiating rollback...", e);
      
      try {
        await this.clearAllTables();
        await this.restoreTables(rollbackSnapshot);
        await this.rebuildSystemState();
      } catch (rErr) {
        console.error("Rollback fail safe error:", rErr);
      }

      if (e.message.includes('DECRYPTION_FAILED')) {
        throw new Error("فشل فك التشفير: كلمة المرور الخاطئة أو مفتاح تشفير معطوب.");
      }
      throw new Error(`فشلت استعادة النظام للنسخة الداخلية وتم التراجع لآخر حالة آمنة: ${e.message || String(e)}`);
    }
  },

  async performRestore(snapshot: any, name: string, id: string = 'EXTERNAL', isIncremental: boolean = false): Promise<void> {
    const user = authService.getCurrentUser();
    
    // Deep structural check on snapshot elements
    this.validateSnapshotIntegrity(snapshot);
    
    await db.runTransaction(async () => {
      // Clear transactional stores
      await db.db.sales.clear();
      await db.db.purchases.clear();
      await db.db.journalEntries.clear();
      await db.db.inventoryTransactions.clear();
      await db.db.financialTransactions.clear();
      await db.db.voucherInvoiceLinks.clear();
      await db.db.settlements.clear();
      await db.db.Audit_Log.clear();
      if (db.db.warehouseStock) await db.db.warehouseStock.clear();
      
      if (!isIncremental) {
        await db.db.products.clear();
        await db.db.customers.clear();
        await db.db.suppliers.clear();
        await db.db.accounts.clear();
      }

      // Restore data mapping
      const tablesSource = snapshot.tables || snapshot;
      for (const table in tablesSource) {
        if (table === 'settings') continue;
        if ((db.db as any)[table] && Array.isArray(tablesSource[table])) {
          await (db.db as any)[table].bulkPut(tablesSource[table]);
        }
      }

      await this.rebuildSystemState();
      await this.verifyRestoreSuccess();

      // Log success audit
      const auditEntry: AuditLogEntry = {
        id: db.generateId('AUD'),
        user_id: user?.User_Email || 'SYSTEM',
        action: 'RESTORE' as any,
        target_type: 'SYSTEM' as any,
        target_id: id,
        timestamp: new Date().toISOString(),
        details: `System restored from internal index record: ${name} (${id})`
      };
      await db.db.Audit_Log.add(auditEntry);
    });
  },

  validateSnapshotIntegrity(snapshot: any) {
    const tableSource = snapshot.tables || snapshot;
    const requiredTables = ['sales', 'purchases', 'journalEntries', 'inventoryTransactions'];
    for (const table of requiredTables) {
      if (!tableSource[table]) {
        throw new Error(`INTEGRITY_ERROR: Expected table "${table}" is missing from schema list.`);
      }
    }
  },

  async rebuildSystemState() {
    // Balances are calculated dynamically in standard views
  },

  async verifyRestoreSuccess() {
    const entries = await db.db.journalEntries.toArray();
    let totalDebit = 0;
    let totalCredit = 0;
    entries.forEach(e => {
      if (e.lines && Array.isArray(e.lines)) {
        e.lines.forEach(l => {
          totalDebit += Number(l.debit || 0);
          totalCredit += Number(l.credit || 0);
        });
      }
    });

    if (Math.abs(totalDebit - totalCredit) > 0.1) {
      throw new Error('RESTORE_VALIDATION_FAILED: General ledger credit-debit mismatch detected.');
    }
  },

  async cleanupOldBackups() {
    const backups = await db.db.systemBackups.orderBy('createdAt').toArray();
    if (backups.length > 30) {
      const toDelete = backups.slice(0, backups.length - 30);
      for (const b of toDelete) {
        await db.db.systemBackups.delete(b.id);
      }
    }
  },

  async runScheduledBackup() {
    const now = new Date();
    const lastBackup = await db.db.systemBackups.orderBy('createdAt').reverse().first();
    
    let shouldBackup = false;
    let type: SystemBackup['backupType'] = 'SCHEDULED_DAILY';
    let isIncremental = true;

    if (lastBackup) {
      const lastDate = new Date(lastBackup.createdAt);
      const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
      
      if (now.getHours() === 2 && lastDate.getDate() !== now.getDate()) {
        shouldBackup = true;
      } else if (diffHours >= 24) {
        shouldBackup = true;
      }

      if (shouldBackup) {
        const isSunday = now.getDay() === 0;
        if (isSunday) {
          type = 'SCHEDULED_WEEKLY';
          isIncremental = false;
        }
      }
    } else {
      shouldBackup = true;
      isIncremental = false;
    }

    if (shouldBackup) {
      await this.createBackup(`Scheduled ${type === 'SCHEDULED_WEEKLY' ? 'Weekly' : 'Daily'} Backup`, type, isIncremental);
    }
  },

  async runIntegrityChecks(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      await db.ensureOpen();
      const isHealthy = await IntegritySweepService.runSweep(false);
      
      if (!isHealthy) {
        errors.push("Data integrity sweep failed. Critical inconsistencies detected.");
      }

      const lastBackup = await db.db.systemBackups.orderBy('createdAt').reverse().first();
      if (lastBackup && lastBackup.status === 'SUCCESS' && lastBackup.dataSnapshot) {
        try {
          const encryptedObj = JSON.parse(lastBackup.dataSnapshot);
          const encryptionPassword = undefined;
          const decryptedData = await EncryptionService.decryptBackup(encryptedObj, encryptionPassword);
          if (!decryptedData) {
            errors.push(`Last backup status verification failed: ${lastBackup.id}`);
          }
        } catch (e) {
          errors.push(`Last backup format validation failed: ${lastBackup.id}`);
        }
      }
    } catch (e: any) {
      errors.push(`System health verification failed: ${e.message}`);
    }

    return { success: errors.length === 0, errors };
  },

  async createEmergencySnapshot() {
    return await this.createBackup('Emergency Snapshot (System Failure)', 'AUTO', false);
  }
};
