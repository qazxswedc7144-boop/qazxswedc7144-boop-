// packages/auth/src/rbac.ts

export type Role = 'ADMIN' | 'ACCOUNTANT' | 'PHARMACIST' | 'CASHIER' | 'AUDITOR' | 'INVENTORY_MANAGER';

export type Permission =
  | 'invoice.create'
  | 'invoice.approve'
  | 'invoice.post'
  | 'stock.adjust'
  | 'journal.view'
  | 'audit.view'
  | 'user.manage'
  | 'branch.view'
  | 'branch.create'
  | 'branch.edit'
  | 'branch.transfer'
  | 'branch.report';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    'invoice.create',
    'invoice.approve',
    'invoice.post',
    'stock.adjust',
    'journal.view',
    'audit.view',
    'user.manage',
    'branch.view',
    'branch.create',
    'branch.edit',
    'branch.transfer',
    'branch.report',
  ],
  ACCOUNTANT: [
    'invoice.create',
    'invoice.approve',
    'invoice.post',
    'journal.view',
    'branch.view',
    'branch.report',
  ],
  PHARMACIST: [
    'invoice.create',
    'stock.adjust',
    'branch.view',
    'branch.transfer',
  ],
  CASHIER: [
    'invoice.create',
    'branch.view',
  ],
  AUDITOR: [
    'journal.view',
    'audit.view',
    'branch.view',
    'branch.report',
  ],
  INVENTORY_MANAGER: [
    'stock.adjust',
    'branch.view',
    'branch.transfer',
  ],
};

/**
 * Checks if a specific role contains a given permission.
 */
export function hasPermission(role: string | Role, permission: Permission): boolean {
  const normRole = String(role).toUpperCase() as Role;
  const list = ROLE_PERMISSIONS[normRole];
  if (!list) return false;
  return list.includes(permission);
}

/**
 * Validates a list of permissions against a role.
 */
export function hasAllPermissions(role: string | Role, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}
