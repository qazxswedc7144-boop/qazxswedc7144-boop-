
import { ROUTES } from '@/utils/navigation';

export const NAVIGATION_ITEMS = [
  { path: ROUTES.DASHBOARD, label: 'لوحة التحكم', icon: 'Home' },
  { path: ROUTES.SALES, label: 'المبيعات', icon: 'CreditCard' },
  { path: ROUTES.PURCHASES, label: 'المشتريات', icon: 'ShoppingBag' },
  { path: ROUTES.INVENTORY, label: 'المخزون', icon: 'Package' },
  { path: ROUTES.ACCOUNTING, label: 'المحاسبة', icon: 'FileText' },
  { path: ROUTES.REPORTS, label: 'التقارير', icon: 'BarChart' },
  { path: ROUTES.SETTINGS, label: 'الإعدادات', icon: 'Settings' },
];

export const MODULES = [
  { id: 'sales', label: 'المبيعات', permission: 'POS_ACCESS', group: 'operational', icon: 'CreditCard' },
  { id: 'purchases', label: 'المشتريات', permission: 'PURCHASE_ACCESS', group: 'operational', icon: 'ShoppingBag' },
  { id: 'inventory', label: 'المخزون', permission: 'INVENTORY_VIEW', group: 'operational', icon: 'Package' },
  { id: 'accounting', label: 'المحاسبة', permission: 'FINANCIAL_ACCESS', group: 'operational', icon: 'FileText' },
  { id: 'reports', label: 'التقارير', permission: 'VIEW_REPORTS', group: 'operational', icon: 'BarChart' },
];
