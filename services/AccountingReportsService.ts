import { db } from './database';

export class AccountingReportsService {
  
  // 1. استعلام الأصناف منخفضة المخزون (Advanced Query)
  static async getLowStockItems() {
    return await db.db.inventory
      .filter(item => item.currentQuantity <= item.minQuantity)
      .sortBy('currentQuantity');
  }

  // 2. تحليل الربح على مستوى العميل (Top 10)
  static async getTopProfitableCustomers() {
    return await db.db.customerProfits
      .orderBy('totalProfit')
      .reverse()
      .limit(10)
      .toArray();
  }

  // 3. الأصناف القريبة من الانتهاء (خلال 30 يوم)
  static async getExpiringSoonItems() {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(today.getDate() + 30);
    
    return await db.db.inventory
      .filter(item => {
        if (!item.expiryDate) return false;
        const expiry = new Date(item.expiryDate);
        return expiry > today && expiry <= nextMonth;
      })
      .toArray();
  }

  // 4. حركة الحسابات للفترة الحالية
  static async getRecentAccountMovements(limit = 20) {
    return await db.db.accountMovements
      .orderBy('date')
      .reverse()
      .limit(limit)
      .toArray();
  }
}
