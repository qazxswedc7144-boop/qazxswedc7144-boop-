
import { db } from './database';
import { SecuritySettings } from '../types';

class AppLockService {
  private static readonly SETTINGS_ID = 'APP_SECURITY_CONFIG';

  async getSettings(): Promise<SecuritySettings | null> {
    try {
      return await db.security_settings.get(AppLockService.SETTINGS_ID) || null;
    } catch (e) {
      return null;
    }
  }

  async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async enableSecurity(username: string, password: string, lockMode: SecuritySettings['lock_mode']): Promise<void> {
    const salt = crypto.randomUUID();
    const password_hash = await this.hashPassword(password, salt);
    
    const settings: SecuritySettings = {
      id: AppLockService.SETTINGS_ID,
      is_enabled: true,
      username,
      password_hash,
      salt,
      lock_mode: lockMode,
      last_active_at: Date.now()
    };

    await db.security_settings.put(settings);
    localStorage.setItem("app_lock_enabled", "true");
  }

  async disableSecurity(): Promise<void> {
    const settings = await this.getSettings();
    if (settings) {
      settings.is_enabled = false;
      await db.security_settings.put(settings);
    }
    localStorage.removeItem("app_lock_enabled");
  }

  async updateActivity(): Promise<void> {
    const settings = await this.getSettings();
    if (settings && settings.is_enabled) {
      await db.security_settings.update(AppLockService.SETTINGS_ID, {
        last_active_at: Date.now()
      });
    }
  }

  async verifyPassword(password: string): Promise<boolean> {
    const settings = await this.getSettings();
    if (!settings || !settings.is_enabled) return true;
    
    const hash = await this.hashPassword(password, settings.salt);
    return hash === settings.password_hash;
  }

  getLockDuration(mode: SecuritySettings['lock_mode']): number {
    switch (mode) {
      case 'instant': return 0;
      case '5m': return 5 * 60 * 1000;
      case '10m': return 10 * 60 * 1000;
      case '20m': return 20 * 60 * 1000;
      case '30m': return 30 * 60 * 1000;
      default: return 0;
    }
  }

  async shouldLock(): Promise<boolean> {
    const settings = await this.getSettings();
    if (!settings || !settings.is_enabled) return false;

    if (settings.lock_mode === 'instant') {
      return false; 
    }

    const duration = this.getLockDuration(settings.lock_mode);
    const idleTime = Date.now() - settings.last_active_at;
    
    return idleTime > duration;
  }
}

export const appLockService = new AppLockService();
