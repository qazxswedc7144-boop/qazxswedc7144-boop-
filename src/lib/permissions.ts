import { Permission } from '../types';

/**
 * SaaS Role-Based Access Control (RBAC) definitions
 * Maps roles to the permissions they hold.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ['*'] as any[], // * implies all permissions
  admin: ['MANAGE_SYSTEM', 'VIEW_REPORTS', 'CREATE_VOUCHER', 'FINANCIAL_ACCESS', 'MANAGE_PARTNERS', 'CREATE_INVOICE', 'EDIT_INVOICE', 'EDIT_VOUCHER', 'ARCHIVE_VIEW'],
  accountant: ['VIEW_REPORTS', 'CREATE_VOUCHER', 'FINANCIAL_ACCESS', 'ARCHIVE_VIEW'],
  clerk: ['CREATE_INVOICE', 'POS_ACCESS', 'INVENTORY_VIEW'],
  user: ['VIEW_REPORTS']
};

/**
 * Universal Permission Helper
 * Examines if the given role has the requested permission
 */
export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  
  const normalizedRole = role.toLowerCase();
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  
  if (!permissions) return false;
  
  // Owner has absolute permission override (denoted by '*')
  if (permissions.includes('*' as any)) return true;
  
  return permissions.includes(permission);
}
