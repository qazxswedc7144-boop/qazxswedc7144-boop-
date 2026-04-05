
import { User, UserRole, Permission } from '../types';
import { db } from './database';
import CryptoJS from 'crypto-js';

const SESSION_KEY = 'pharmaflow_session_v4_secure';
const SECRET_KEY = 'pharmaflow_local_secret_key_123'; // In a real app this would be more secure

/**
 * Auth Service - محرك التحكم في الوصول (RBAC Guard)
 */
export const authService = {
  
  hashPassword: (password: string, salt: string): string => {
    return CryptoJS.SHA256(password + salt).toString();
  },

  generateSalt: (): string => {
    return CryptoJS.lib.WordArray.random(16).toString();
  },

  generateToken: (user: User): string => {
    const payload = {
      user_id: user.user_id,
      email: user.User_Email,
      name: user.User_Name,
      role: user.Role,
      tenant_id: user.tenant_id,
      expiry: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };
    return CryptoJS.AES.encrypt(JSON.stringify(payload), SECRET_KEY).toString();
  },

  validateSession: (): User | null => {
    const token = localStorage.getItem(SESSION_KEY);
    if (!token) return null;

    try {
      const bytes = CryptoJS.AES.decrypt(token, SECRET_KEY);
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedData) return null;
      
      const payload = JSON.parse(decryptedData);
      
      if (payload.expiry < Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      
      return {
        id: payload.user_id,
        user_id: payload.user_id,
        User_Email: payload.email,
        User_Name: payload.name,
        Role: payload.role,
        Is_Active: true,
        tenant_id: payload.tenant_id
      } as User;
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },

  getCurrentUser: (): User => {
    const validatedUser = authService.validateSession();
    if (validatedUser) return validatedUser;

    // Default mock user for development if no session (only for initial setup)
    return {
      id: 'USR-DEV-001',
      user_id: 'USR-DEV-001',
      User_Email: 'admin@pharmaflow.local',
      User_Name: 'مدير النظام',
      Role: 'Admin',
      Is_Active: true,
      tenant_id: 'TEN-DEV-001',
      lastLogin: new Date().toISOString()
    };
  },

  register: async (email: string, username: string, password: string, role: UserRole, tenantId: string): Promise<boolean> => {
    const salt = authService.generateSalt();
    const password_hash = authService.hashPassword(password, salt);
    
    const newUser: User = {
      id: `USR-${Date.now()}`,
      user_id: `USR-${Date.now()}`,
      User_Email: email,
      User_Name: username,
      Role: role,
      Is_Active: true,
      tenant_id: tenantId,
      password_hash,
      salt,
      created_at: new Date().toISOString()
    };

    await db.users.put(newUser);
    return true;
  },

  login: async (email: string, password: string): Promise<boolean> => {
    const user = await db.users.get(email);
    if (!user || !user.password_hash || !user.salt) return false;

    const inputHash = authService.hashPassword(password, user.salt);
    if (inputHash === user.password_hash) {
      const token = authService.generateToken(user);
      localStorage.setItem(SESSION_KEY, token);
      
      // Update last login
      await db.users.update(email, { lastLogin: new Date().toISOString() });
      return true;
    }
    return false;
  },

  /**
   * الفحص الأساسي للصلاحية (Permission Check Engine)
   */
  hasPermission: (permission: Permission): boolean => {
    const user = authService.getCurrentUser();
    const role = user.Role;

    // 1. Admin له صلاحية مطلقة دائماً (Full Access)
    if (role === 'Admin') return true;

    // 2. Accountant (المحاسب) - صلاحيات مالية شاملة
    if (role === 'Accountant') {
      const allowed: Permission[] = [
        'CREATE_INVOICE', 'EDIT_INVOICE', 
        'CREATE_VOUCHER', 'EDIT_VOUCHER', 
        'VIEW_REPORTS', 'FINANCIAL_ACCESS',
        'MANAGE_PARTNERS', 'ARCHIVE_VIEW',
        'INVENTORY_VIEW'
      ];
      return allowed.includes(permission);
    }

    // 3. Clerk (موظف مبيعات) - صلاحيات البيع فقط
    if (role === 'Clerk') {
      const allowed: Permission[] = [
        'CREATE_INVOICE', 
        'POS_ACCESS', 
        'INVENTORY_VIEW'
      ];
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
