import { Permission } from '@/types';

/**
 * SaaS Role-Based Access Control (RBAC) definitions
 * Maps roles to the permissions they hold.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ['*'] as any[], // * implies all permissions
  admin: [
    'MANAGE_SYSTEM', 'VIEW_REPORTS', 'CREATE_VOUCHER', 'FINANCIAL_ACCESS', 
    'MANAGE_PARTNERS', 'CREATE_INVOICE', 'EDIT_INVOICE', 'EDIT_VOUCHER', 
    'ARCHIVE_VIEW', 'BRANCH_VIEW', 'BRANCH_CREATE', 'BRANCH_EDIT', 
    'BRANCH_TRANSFER', 'BRANCH_REPORT', 'PURCHASE_ACCESS'
  ],
  accountant: [
    'VIEW_REPORTS', 'CREATE_VOUCHER', 'FINANCIAL_ACCESS', 'ARCHIVE_VIEW', 
    'BRANCH_VIEW', 'BRANCH_REPORT', 'PURCHASE_ACCESS'
  ],
  clerk: [
    'CREATE_INVOICE', 'POS_ACCESS', 'INVENTORY_VIEW', 
    'BRANCH_VIEW', 'BRANCH_TRANSFER', 'PURCHASE_ACCESS'
  ],
  user: [
    'VIEW_REPORTS', 'BRANCH_VIEW'
  ],
  // Database mappings (lowercase equivalents)
  cashier: [
    'CREATE_INVOICE', 'POS_ACCESS', 'INVENTORY_VIEW', 
    'BRANCH_VIEW', 'BRANCH_TRANSFER', 'PURCHASE_ACCESS'
  ],
  pharmacist: [
    'MANAGE_SYSTEM', 'VIEW_REPORTS', 'CREATE_VOUCHER', 'FINANCIAL_ACCESS', 
    'MANAGE_PARTNERS', 'CREATE_INVOICE', 'EDIT_INVOICE', 'EDIT_VOUCHER', 
    'ARCHIVE_VIEW', 'BRANCH_VIEW', 'BRANCH_CREATE', 'BRANCH_EDIT', 
    'BRANCH_TRANSFER', 'BRANCH_REPORT', 'PURCHASE_ACCESS'
  ],
  inventory_manager: [
    'MANAGE_SYSTEM', 'VIEW_REPORTS', 'INVENTORY_VIEW', 
    'BRANCH_VIEW', 'BRANCH_TRANSFER', 'BRANCH_REPORT', 'PURCHASE_ACCESS'
  ]
};

/**
 * Universal Permission Helper
 * Examines if the given role has the requested permission
 */
export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role || role.trim() === "") return false;
  
  const normalizedRole = role.toLowerCase().trim();
  if (normalizedRole === 'admin' || normalizedRole === 'owner' || normalizedRole === 'local-admin') return true;
  
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  
  if (!permissions) return false;
  
  // Owner has absolute permission override (denoted by '*')
  if (permissions.includes('*' as any)) return true;
  
  return permissions.includes(permission);
}
