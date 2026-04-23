
import { User, UserRole, Permission } from '../types';
import { can } from '../lib/permissions';

const SESSION_KEY = 'pharmaflow_session_v4_secure';

// Local cache to bridge React context state (useAuth) to synchronous legacy modules
let localUserCache: User | null = null;

/**
 * Auth Service - Hybrid SaaS Bridge
 * Combines state with legacy synchronous calls for backward compatibility.
 */
export const authService = {
  
  /**
   * Called by useAuth() securely to update the local memory reference for legacy modules.
   */
  setLocalUserCache: (profile: any) => {
    if (!profile) {
      localUserCache = null;
      return;
    }
    localUserCache = {
      id: profile.id,
      user_id: profile.id,
      User_Email: profile.email || 'offline@system.local',
      User_Name: (profile.email || profile.name || 'User').split('@')[0], 
      Role: profile.role,
      Is_Active: true,
      tenant_id: profile.organization_id || 'DEFAULT_TENANT'
    } as User;
  },

  /**
   * Synchronous getter for current user. Relies on the cache set by useAuth().
   * WARNING: For React components, prefer `const { profile } = useAuth();`
   */
  getCurrentUser: (): User => {
    if (localUserCache) return localUserCache;
    
    // Default mock user for offline start/bootstrapping 
    return {
      id: 'local-admin-123',
      user_id: 'local-admin-123',
      User_Email: 'admin@pharmaflow.local',
      User_Name: 'مدير النظام',
      Role: 'Admin',
      Is_Active: true,
      tenant_id: 'DEFAULT_TENANT'
    } as User;
  },

  /**
   * الفحص الأساسي للصلاحية (Permission Check Engine)
   */
  hasPermission: (permission: Permission): boolean => {
    const user = authService.getCurrentUser();
    return can(user.Role, permission);
  },

  /**
   * فحص الدور المباشر
   */
  isRole: (role: string): boolean => {
    return authService.getCurrentUser().Role.toLowerCase() === role.toLowerCase();
  },

  /**
   * تسجيل الخروج
   */
  logout: async () => {
    localUserCache = null;
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
