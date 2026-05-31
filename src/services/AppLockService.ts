export class AppLockService {
  private isLocked = false;
  private settings = {
    is_enabled: false,
    lock_mode: '5m',
    isSimpleLockEnabled: false,
    lockMode: '5m',
    simplePin: '',
    username: '',
  };

  lock() {
    this.isLocked = true;
    console.log('[AppLock] System Locked');
  }

  unlock() {
    this.isLocked = false;
    console.log('[AppLock] System Unlocked');
  }

  getStatus() { return this.isLocked; }
  getSettings() { return this.settings; }
  updateActivity() { console.log('[AppLock] Activity updated'); }
  shouldLock() { return false; }
  isSimpleLockEnabled() { return this.settings.isSimpleLockEnabled; }
  verifySimplePin(pin: string) { return pin === this.settings.simplePin; }
  verifyPassword(_pass: string) { return true; }
  setSimpleLockEnabled(val: boolean) { this.settings.isSimpleLockEnabled = val; }
  setSimplePin(pin: string) { this.settings.simplePin = pin; }
  enableSecurity(username?: string, _password?: string, mode?: string) { 
    this.settings.is_enabled = true;
    this.settings.username = username || '';
    this.settings.lock_mode = mode || '5m';
    console.log('[AppLock] Security enabled'); 
  }
}

export const appLockService = new AppLockService();
