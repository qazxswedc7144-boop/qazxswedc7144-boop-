
import { BackupService } from './backupService';

/**
 * Backup Service Wrapper - نظام النسخ الاحتياطي المتقدم
 */

let timer: any = null;
const CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour

export const backupService = {
  async createAutoSnapshot() {
    await BackupService.runScheduledBackup();
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
