
import { authService } from './auth.service';
import { PeriodLockEngine } from './PeriodLockEngine';
import { ValidationError } from '../types';

export class GlobalGuard {
  /**
   * Checks the system state before any critical operation.
   */
  static async checkSystemState(operation: string, date?: string) {
    // 1. Authentication Check
    const user = authService.getCurrentUser();
    if (!user) {
      throw new ValidationError("يجب تسجيل الدخول للقيام بهذه العملية.");
    }

    // 2. Period Lock Check
    if (date) {
      await PeriodLockEngine.validateOperation(date, operation);
    }

    // 3. Maintenance Mode Check (Optional)
    // if (window.isMaintenanceMode) {
    //   throw new ValidationError("النظام في وضع الصيانة حالياً.");
    // }

    // 4. Permission Check
    // authService.assertPermission(operation as any, operation);
  }
}
