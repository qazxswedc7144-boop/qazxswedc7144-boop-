
import { db } from '../services/database';

/**
 * ChartOfAccounts Service
 * يحل محل الثوابت القديمة ويوفر وصولاً ديناميكياً للحسابات
 */
export const ChartOfAccounts = {
  getAccounts: () => db.getAccounts(),
  
  getAccountByName: (name: string) => {
    return db.getAccounts().find(a => a.name === name);
  },

  getAccountById: (id: string) => {
    return db.getAccounts().find(a => a.id === id);
  },

  // توفير معرفات الحسابات الأساسية للنظام (Fallback)
  getSystemAccounts: () => ({
    CASH: db.getAccounts().find(a => a.code === '1101')?.id || 'ACC-101',
    INVENTORY: db.getAccounts().find(a => a.code === '1102')?.id || 'ACC-102',
    CUSTOMERS: db.getAccounts().find(a => a.code === '1103')?.id || 'ACC-103',
    SUPPLIERS: db.getAccounts().find(a => a.code === '2101')?.id || 'ACC-201',
    SALES: db.getAccounts().find(a => a.code === '4101')?.id || 'ACC-401',
    COGS: db.getAccounts().find(a => a.code === '5101')?.id || 'ACC-501',
    EXPENSES: db.getAccounts().find(a => a.code === '5102')?.id || 'ACC-502',
  })
};

// للحفاظ على التوافق مع الكود القديم (سيتم استخدامه كـ Fallback)
export const ACCOUNTS = {
  CASH: "الصندوق",
  INVENTORY: "المخزون",
  SUPPLIERS: "الموردون",
  SALES: "المبيعات",
  COGS: "تكلفة البضاعة المباعة",
  EXPENSES: "المصروفات",
  CUSTOMERS: "العملاء"
};
