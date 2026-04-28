
import { db } from '../lib/database';
import { authService } from './auth.service';
import { useAppStore } from '../store/useAppStore';
import { SystemErrorLog } from '../types';

export class ErrorManager {
  /**
   * تنفيذ دالة مع إمكانية إعادة المحاولة في حال فشل الشبكة أو تعليق الداتا
   */
  static async retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      await new Promise(r => setTimeout(r, delay));
      return this.retry(fn, retries - 1, delay * 2); // Exponential backoff
    }
  }

  /**
   * تسجيل أخطاء الأتمتة (Automation Error Manager)
   * Trigger: If any automation fails -> Log error & Show non-blocking warning
   */
  static logAutomationError(module: string, message: string, recordId: string = 'N/A') {
    const user = authService.getCurrentUser();
    const timestamp = new Date().toISOString();
    const errorId = `ERR-AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const errorEntry: SystemErrorLog = {
      id: errorId,
      Error_ID: errorId,
      Module_Name: module,
      Error_Message: message,
      Record_ID: recordId,
      User_Email: user?.User_Email || 'SYSTEM',
      Timestamp: timestamp
    };

    // 1. تسجيل الخطأ في الخلفية (Silent Log)
    setTimeout(async () => {
      try {
        await db.db.System_Error_Log.add(errorEntry);
      } catch (e) {
        console.error("Critical failure: Error Log failed itself", e);
      }
    }, 0);

    // 2. إظهار تنبيه غير حاجب للمستخدم (Non-blocking warning)
    useAppStore.getState().addToast(`تنبيه نظام: فشل في محرك [${module}] - تم توثيق الخطأ برقم ${errorId}`, 'warning');
  }

  /**
   * تسجيل الخطأ في سجل الرقابة وتنبيه المستخدم
   */
  static handleError(error: any, context: string) {
    console.error(`[ErrorManager] ${context}:`, error);
    db.addAuditLog('SYSTEM', 'OTHER', context, error.message || "حدث خطأ غير معروف");
    
    if (error.message?.includes("QuotaExceededError")) {
       alert("تنبيه: مساحة تخزين المتصفح ممتلئة. يرجى حذف بعض البيانات القديمة.");
    }
  }
}
