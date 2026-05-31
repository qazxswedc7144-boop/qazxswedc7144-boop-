
import { db } from '@/core/db';

export class PeriodLockEngine {
  static async isPeriodLocked(dateStr: string): Promise<boolean> {
    try {
      const date = new Date(dateStr);
      const periods = await db.db.accountingPeriods.toArray();
      const matchingPeriod = periods.find(p => {
        const start = new Date(p.Start_Date);
        const end = new Date(p.End_Date);
        return date >= start && date <= end;
      });
      return matchingPeriod ? matchingPeriod.Is_Locked : false;
    } catch (error) {
      console.error('[PeriodLockEngine] Error checking lock:', error);
      return false;
    }
  }

  static async lockPeriod(periodId: string) {
    return await db.db.accountingPeriods.update(periodId, { Is_Locked: true, Locked_At: new Date().toISOString() });
  }

  static async validateOperation(dateStr: string, _optional?: any) {
    const isLocked = await this.isPeriodLocked(dateStr);
    if (isLocked) {
      throw new Error('This period is locked for accounting.');
    }
    return true;
  }

  static async seedDefaultPeriod() {
    const count = await db.db.accountingPeriods.count();
    if (count === 0) {
      const now = new Date();
      await db.db.accountingPeriods.add({
        id: 'DEFAULT-PERIOD',
        Start_Date: new Date(now.getFullYear(), 0, 1).toISOString(),
        End_Date: new Date(now.getFullYear(), 11, 31).toISOString(),
        Is_Locked: false
      });
    }
  }
}
