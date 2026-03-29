
import { User, UserRole, Permission } from '../types';

const SESSION_KEY = 'pharmaflow_session_v4_secure';

/**
 * Auth Service - محرك التحكم في الوصول (RBAC Guard)
 */
export const authService = {
  
  // للحصول على تجربة المحاكاة، يمكن تغيير الدور هنا يدوياً لاختبار الأدوار المختلفة
  // الخيارات: 'Admin', 'Accountant', 'DataEntry'
  getCurrentUser: (): User => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      try {
        return JSON.parse(session);
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    // Default mock user for development if no session
    return {
      user_id: 'USR-DEV-001',
      User_Email: 'admin@pharmaflow.local',
      User_Name: 'مدير النظام',
      Role: 'Admin',
      Is_Active: true,
      tenant_id: 'TEN-DEV-001',
      lastLogin: new Date().toISOString()
    };
  },

  login: async (email: string, password?: string, tenantId?: string): Promise<boolean> => {
    // In a real SaaS, this would call Firebase Auth or a backend API
    // For now, we simulate a successful login and store the tenant info
    const mockUser: User = {
      user_id: `USR-${Date.now()}`,
      User_Email: email,
      User_Name: email.split('@')[0],
      Role: 'Admin',
      Is_Active: true,
      tenant_id: tenantId || 'TEN-DEV-001',
      lastLogin: new Date().toISOString()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockUser));
    return true;
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
  },

  /**
   * الحصول على معرف الفرع الحالي
   */
  getCurrentBranchId: (): string => {
    return localStorage.getItem('pharmaflow_branch_id') || 'MAIN-BRANCH';
  }
};
