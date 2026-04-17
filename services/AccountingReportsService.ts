
import { db } from '../services/database';
import { ReportEngine } from '@/core/engines/reportEngine';

export class AccountingReportsService {
  
  // 1. استعلام الأصناف منخفضة المخزون (Advanced Query)
  static async getLowStockItems() {
    return await db.db.inventory
      .filter(item => item.currentQuantity <= item.minQuantity)
      .sortBy('currentQuantity');
  }

  // 2. تحليل الربح على مستوى العميل (Top 10)
  static async getTopProfitableCustomers() {
    return await ReportEngine.getCustomerProfit();
  }

  // 3. الأصناف القريبة من الانتهاء (خلال 30 يوم)
  static async getExpiringSoonItems() {
    const products = await db.getProducts();
    const today = new Date();
    return products.filter(p => {
      if (!p.ExpiryDate) return false;
      const expiry = new Date(p.ExpiryDate);
      const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 30 && diffDays > 0;
    });
  }

  // 4. حركة الحسابات للفترة الحالية
  static async getRecentAccountMovements(limit = 20) {
    const entries = await db.getJournalEntries();
    return entries
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  // New enterprise methods
  static async getTrialBalance() {
    return await ReportEngine.getTrialBalance();
  }

  static async getIncomeStatement() {
    return await ReportEngine.getIncomeStatement();
  }

  static async getInventoryValuation() {
    return await ReportEngine.getInventoryValue();
  }
}
