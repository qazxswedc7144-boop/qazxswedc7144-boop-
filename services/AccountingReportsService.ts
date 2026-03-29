import { db } from './database';
import { ReportEngine } from './ReportEngine';

export class AccountingReportsService {
  
  // 1. استعلام الأصناف منخفضة المخزون (Advanced Query)
  static async getLowStockItems() {
    return await db.db.inventory
      .filter(item => item.currentQuantity <= item.minQuantity)
      .sortBy('currentQuantity');
  }

  // 2. تحليل الربح على مستوى العميل (Top 10)
  static async getTopProfitableCustomers() {
    return await ReportEngine.getCustomerProfitability();
  }

  // 3. الأصناف القريبة من الانتهاء (خلال 30 يوم)
  static async getExpiringSoonItems() {
    const report = await ReportEngine.getExpiryReport();
    return report.filter(r => r.daysRemaining <= 30 && r.daysRemaining > 0);
  }

  // 4. حركة الحسابات للفترة الحالية
  static async getRecentAccountMovements(limit = 20) {
    return await db.db.accountMovements
      .orderBy('date')
      .reverse()
      .limit(limit)
      .toArray();
  }

  // New enterprise methods
  static async getTrialBalance() {
    return await ReportEngine.getTrialBalance();
  }

  static async getIncomeStatement() {
    return await ReportEngine.getIncomeStatement();
  }

  static async getInventoryValuation() {
    return await ReportEngine.getInventoryValuation();
  }
}
