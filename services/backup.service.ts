
import { BackupService } from './backupService';

/**
 * Backup Service Wrapper - نظام النسخ الاحتياطي المتقدم
 */

let timer: any = null;
const CHECK_INTERVAL = 12 * 60 * 60 * 1000; // 11. AUTO BACKUP: every 12 hours

export const backupService = {
  async createAutoSnapshot() {
    // Use internal secure key for auto-backups
    const internalKey = 'pharmaflow-internal-secure-key-2026';
    await BackupService.createBackup('Auto Backup', 'AUTO', false, internalKey);
    
    // Also try to sync with Google Apps Script
    try {
      await BackupService.uploadBackup(internalKey);
    } catch (e) {
      console.warn("Auto sync failed (likely script URL not configured)");
    }
  },

  async handleAppClose() {
    // 11. AUTO BACKUP: app close
    const internalKey = 'pharmaflow-internal-secure-key-2026';
    await BackupService.createBackup('App Close Backup', 'AUTO', false, internalKey);
  },

  startAutoTimer() {
    if (timer) return;

    // Run initial check
    this.createAutoSnapshot();

    timer = setInterval(() => {
      this.createAutoSnapshot();
    }, CHECK_INTERVAL);
    
    console.log("[BackupEngine] Professional backup scheduler active.");
  },

  stopAutoTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
};
