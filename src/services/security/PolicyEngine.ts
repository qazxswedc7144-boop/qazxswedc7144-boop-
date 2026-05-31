import { UserRole, Permission } from '@/types';

export class PolicyEngine {
  private static ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    'Admin': ['FULL_ACCESS', 'MANAGE_SYSTEM', 'FINANCIAL_ACCESS'],
    'Accountant': ['CREATE_VOUCHER', 'EDIT_VOUCHER', 'VIEW_REPORTS', 'FINANCIAL_ACCESS'],
    'Clerk': ['CREATE_INVOICE', 'POS_ACCESS', 'INVENTORY_VIEW']
  };

  static can(role: UserRole, permission: Permission): boolean {
    const perms = this.ROLE_PERMISSIONS[role] || [];
    if (perms.includes('FULL_ACCESS')) return true;
    return perms.includes(permission);
  }

  static getPermissions(role: UserRole): Permission[] {
    return this.ROLE_PERMISSIONS[role] || [];
  }
}
