import { db } from '@/core/db';
import type { SettingValue } from './SettingsService';

export class SettingsRepository {
  async get(key: string): Promise<SettingValue> {
    const record = await db.settings.get(key);
    return record?.value as SettingValue;
  }

  async set(key: string, value: SettingValue): Promise<void> {
    await db.settings.put({ key, value });
  }

  async getAll(): Promise<Record<string, SettingValue>> {
    const records = await db.settings.toArray();
    return records.reduce((acc, curr) => {
      acc[curr.key] = curr.value as SettingValue;
      return acc;
    }, {} as Record<string, SettingValue>);
  }
}

export const settingsRepository = new SettingsRepository();
