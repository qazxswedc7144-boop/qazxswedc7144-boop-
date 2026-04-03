
import { db } from './database';
import { AccountingPeriod, PeriodLockLog } from '../types';
import { authService } from './auth.service';
import { SyncEngine } from './SyncEngine';

export class PeriodLockEngine {
  
  /**
   * 2. CREATE DEFAULT PERIOD
   */
  static async seedDefaultPeriod() {
    const count = await db.Accounting_Periods.count();
    if (count === 0) {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();
      
      const defaultPeriod: AccountingPeriod = {
        id: db.generateId('PRD'),
        Start_Date: startOfYear,
        End_Date: endOfYear,
        Is_Locked: false,
        tenant_id: SyncEngine.getTenantId() || 'TEN-DEV-001',
        lastModified: new Date().toISOString()
      };
      
      await db.Accounting_Periods.put(defaultPeriod);
      await SyncEngine.saveDoc('Accounting_Periods', defaultPeriod.id, defaultPeriod);
    }
  }

  /**
   * 3. CREATE FUNCTION isDateLocked(date)
   */
  static async isDateLocked(dateStr: string): Promise<boolean> {
    if (!dateStr) return false;
    const checkDate = new Date(dateStr).getTime();

    const periods = await db.Accounting_Periods.toArray();
    
    const period = periods.find((p: AccountingPeriod) => {
      const start = new Date(p.Start_Date).getTime();
      const end = new Date(p.End_Date).getTime();
      return checkDate >= start && checkDate <= end;
    });

    return period ? period.Is_Locked : false;
  }

  /**
   * 4. BLOCK OPERATIONS & 5. ERROR MESSAGE
   */
  static async validateOperation(dateStr: string, action: string): Promise<void> {
    const isLocked = await this.isDateLocked(dateStr);
    if (isLocked) {
      const user = authService.getCurrentUser();
      // 9. ADMIN OVERRIDE
      if (user?.Role === 'Admin') {
        await this.logOverride(action, user.User_Email, dateStr);
        return;
      }
      throw new Error(`الفترة مغلقة — لا يمكن ${action}`);
    }
  }

  /**
   * تسجيل تجاوز القفل من قبل المدير
   */
  private static async logOverride(action: string, userEmail: string, date: string): Promise<void> {
    const log: PeriodLockLog = {
      id: db.generateId('PLOG'),
      action: `ADMIN_OVERRIDE_${action}`,
      user: userEmail,
      timestamp: new Date().toISOString(),
      periodId: 'OVERRIDE',
      details: `تجاوز قفل الفترة للتاريخ: ${date}`,
      lastModified: new Date().toISOString()
    };
    await db.periodLockLogs.add(log);
  }

  /**
   * 6. LOCK FUNCTION
   */
  static async lockPeriod(periodId: string): Promise<void> {
    const user = authService.getCurrentUser();
    if (user?.Role !== 'Admin') throw new Error("صلاحية المدير مطلوبة لقفل الفترات 🛡️");

    const update = {
      Is_Locked: true,
      Locked_By: user.User_Email,
      Locked_At: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    await db.Accounting_Periods.update(periodId, update);
    const period = await db.Accounting_Periods.get(periodId);
    if (period) {
      await SyncEngine.saveDoc('Accounting_Periods', periodId, period);
    }
  }

  /**
   * 7. UNLOCK FUNCTION
   */
  static async unlockPeriod(periodId: string): Promise<void> {
    const user = authService.getCurrentUser();
    if (user?.Role !== 'Admin') throw new Error("صلاحية المدير مطلوبة لإلغاء قفل الفترات 🛡️");

    const update = {
      Is_Locked: false,
      lastModified: new Date().toISOString()
    };

    await db.Accounting_Periods.update(periodId, update);
    const period = await db.Accounting_Periods.get(periodId);
    if (period) {
      await SyncEngine.saveDoc('Accounting_Periods', periodId, period);
    }
  }
}
