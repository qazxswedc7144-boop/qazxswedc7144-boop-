
import { db } from './database';
import { AccountingPeriod, PeriodLockLog } from '../types';
import { authService } from './auth.service';

export class PeriodLockEngine {
  /**
   * التحقق مما إذا كان التاريخ يقع ضمن فترة محاسبية مغلقة
   */
  static async isDateLocked(dateStr: string): Promise<boolean> {
    if (!dateStr) return false;
    const checkDate = new Date(dateStr);
    checkDate.setHours(0, 0, 0, 0);

    const periods = await db.db.Accounting_Periods.where('Is_Locked').equals(1).toArray();
    
    return periods.some((p: AccountingPeriod) => {
      const start = new Date(p.Start_Date);
      const end = new Date(p.End_Date);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return checkDate >= start && checkDate <= end;
    });
  }

  /**
   * التحقق من الصلاحية قبل إجراء أي عملية تعديل أو حذف
   */
  static async validateOperation(dateStr: string, action: string): Promise<void> {
    const isLocked = await this.isDateLocked(dateStr);
    if (isLocked) {
      const user = authService.getCurrentUser();
      // السماح للمدير بالتجاوز مع تسجيل لوق
      if (user?.Role === 'Admin') {
        await this.logOverride(action, user.User_Email, dateStr);
        return;
      }
      throw new Error(`SECURITY_BLOCK: التاريخ ${dateStr} يقع ضمن فترة محاسبية مغلقة. لا يمكن إجراء عملية ${action} 🔒`);
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
    await db.db.periodLockLogs.add(log);
  }

  /**
   * قفل فترة محاسبية
   */
  static async lockPeriod(periodId: string): Promise<void> {
    const user = authService.getCurrentUser();
    if (user?.Role !== 'Admin') throw new Error("صلاحية المدير مطلوبة لقفل الفترات 🛡️");

    await db.db.Accounting_Periods.update(periodId, {
      Is_Locked: true,
      Locked_By: user.User_Email,
      Locked_At: new Date().toISOString(),
      lastModified: new Date().toISOString()
    });
  }
}
