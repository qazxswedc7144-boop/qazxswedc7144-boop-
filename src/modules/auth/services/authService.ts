
import { can as canHelper } from '@/utils/permissions';
import { Permission } from '@/types';

/**
 * Auth Service for Local-Only Operation
 * Safe permission checking wired with the real RBAC policy
 */

export const authService = {
  getCurrentUser: () => {
    try {
      const raw = localStorage.getItem('pharmaflow_user');
      if (raw) {
        const u = JSON.parse(raw);
        return {
          id: u.id,
          User_Email: `${u.username}@local.host`,
          Role: u.role, // e.g. ADMIN, ACCOUNTANT, CASHIER etc.
          User_Name: u.username
        };
      }
    } catch {
      // Ignored
    }
    return null;
  },

  isSignedIn: () => {
    return !!localStorage.getItem('pharmaflow_token');
  },

  assertPermission: (permission: string, operation: string) => {
    console.log(`Permission ${permission} evaluated for ${operation}`);
    return authService.can(permission);
  },

  can: (permission: string) => {
    const user = authService.getCurrentUser();
    if (!user) return false;
    return canHelper(user.Role, permission as Permission);
  },

  logout: async () => {
    localStorage.removeItem('pharmaflow_token');
    localStorage.removeItem('pharmaflow_refresh_token');
    localStorage.removeItem('pharmaflow_user');
    window.location.reload();
  }
};
