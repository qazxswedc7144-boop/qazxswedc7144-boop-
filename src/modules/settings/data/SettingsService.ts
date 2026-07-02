import { settingsRepository } from './SettingsRepository';
import { db } from '@/core/db';

export type SettingValue = string | boolean | number | null;

export class SettingsService {
  async getAllSettings(): Promise<Record<string, SettingValue>> {
    return await settingsRepository.getAll();
  }

  async getSettingsGroup(groupKeys: string[]): Promise<Record<string, SettingValue>> {
    const all = await this.getAllSettings();
    return groupKeys.reduce((acc, key) => {
      acc[key] = all[key] ?? null;
      return acc;
    }, {} as Record<string, SettingValue>);
  }

  async saveSetting(key: string, value: SettingValue, sync: boolean = false) {
    await settingsRepository.set(key, value);
    
    if (sync) {
      await this.addToOutbox('UPDATE_SETTING', { key, value });
    }
  }

  async saveMultipleSettings(settings: Record<string, SettingValue>, sync: boolean = false) {
    const entries = Object.entries(settings);
    await db.transaction('rw', db.settings, db.outbox, async () => {
      for (const [key, value] of entries) {
        await settingsRepository.set(key, value);
      }
      if (sync) {
        await this.addToOutbox('UPDATE_SETTINGS_BATCH', settings);
      }
    });
  }

  private async addToOutbox(type: string, payload: unknown) {
    const mutationId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    await db.outbox.add({
      mutationId,
      idempotencyKey,
      type,
      payload,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0
    });
  }
}

export const settingsService = new SettingsService();
