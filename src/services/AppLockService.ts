export class AppLockService {
  private isLocked = false;
  private lastActivityTime = Date.now();
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
    this.lastActivityTime = Date.now();
    console.log('[AppLock] System Unlocked');
  }

  getStatus() { return this.isLocked; }
  getSettings() { return this.settings; }
  
  updateActivity() { 
    this.lastActivityTime = Date.now();
    console.log('[AppLock] Activity updated: ', this.lastActivityTime); 
  }
  
  getLastActivityTime() {
    return this.lastActivityTime;
  }

  shouldLock() { 
    const mode = this.settings.lock_mode || '5m';
    if (mode === 'instant') return false;
    
    let minutes = 5;
    if (mode === '1m') minutes = 1;
    else if (mode === '5m') minutes = 5;
    else if (mode === '15m') minutes = 15;
    else if (mode === '30m') minutes = 30;
    else if (mode === '1h') minutes = 60;
    
    const elapsed = Date.now() - this.lastActivityTime;
    return elapsed > minutes * 60 * 1000; 
  }

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
