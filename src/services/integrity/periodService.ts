
import { db } from '@/core/db';

export class PeriodService {
  static async getCurrentPeriod() {
    const periods = await db.db.accountingPeriods.toArray();
    return periods[periods.length - 1];
  }

  async validatePeriod(_dateStr: string) {
    return true;
  }
}

export const periodService = new PeriodService();
