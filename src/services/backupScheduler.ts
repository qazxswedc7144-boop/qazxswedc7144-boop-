
class BackupScheduler {
  start() {
    console.log('[BackupScheduler] Started');
  }

  stop() {
    console.log('[BackupScheduler] Stopped');
  }

  stopAutoTimer() {
    console.log('[BackupScheduler] Auto timer stopped');
  }
}

export const backupService = new BackupScheduler();
