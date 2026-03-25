
import { User, UserRole, Permission } from '../types';

const SESSION_KEY = 'pharmaflow_session_v4_secure';

/**
 * Auth Service - محرك التحكم في الوصول (RBAC Guard)
 */
export const authService = {
  
  // للحصول على تجربة المحاكاة، يمكن تغيير الدور هنا يدوياً لاختبار الأدوار المختلفة
  // الخيارات: 'Admin', 'Accountant', 'DataEntry'
  getCurrentUser: (): User => {
    return {
      User_Email: 'user@pharmaflow.local',
      User_Name: 'موظف النظام',
      Role: 'Admin', // افتراضياً Admin للمطور، يتم التحكم به برمجياً في الواجهة
      Is_Active: true,
      lastLogin: new Date().toISOString()
    };
  },

  /**
   * الفحص الأساسي للصلاحية (Permission Check Engine)
   */
  hasPermission: (permission: Permission): boolean => {
    const user = authService.getCurrentUser();
    const role = user.Role;

    // 1. Admin له صلاحية مطلقة دائماً (Full Access)
    if (role === 'Admin') return true;

    // 2. Accountant (المحاسب) - صلاحيات مالية شاملة بدون إدارة النظام
    if (role === 'Accountant') {
      const allowed: Permission[] = [
        'CREATE_INVOICE', 'EDIT_INVOICE', 
        'CREATE_VOUCHER', 'EDIT_VOUCHER', 
        'VIEW_REPORTS', 'FINANCIAL_ACCESS'
      ];
      return allowed.includes(permission);
    }

    // 3. DataEntry (مدخل البيانات) - صلاحية الإنشاء فقط
    if (role === 'DataEntry') {
      const allowed: Permission[] = ['CREATE_INVOICE'];
      return allowed.includes(permission);
    }

    return false;
  },

  /**
   * فحص الدور المباشر
   */
  isRole: (role: UserRole): boolean => {
    return authService.getCurrentUser().Role === role;
  },

  /**
   * تسجيل الخروج
   */
  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  },

  /**
   * التحقق من إمكانية تنفيذ إجراء مالي معين (Service Layer Guard)
   */
  assertPermission: (permission: Permission, actionDescription: string) => {
    if (!authService.hasPermission(permission)) {
      throw new Error(`خطأ أمني سيادي: لا تملك الصلاحيات الكافية لـ [${actionDescription}]. يرجى مراجعة مدير النظام.`);
    }
  }
};
