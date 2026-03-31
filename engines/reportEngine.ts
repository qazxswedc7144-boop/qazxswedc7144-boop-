
import { Sale, Purchase, Product, Supplier, InventoryItem, ItemProfitEntry, CustomerProfitEntry, SupplierProfitEntry, AccountMovement } from '../types';

export class ReportEngine {
  /**
   * Generates a summary of sales by date.
   */
  static getSalesSummary(sales: Sale[]): { date: string, total: number, count: number }[] {
    const summary: { [date: string]: { total: number, count: number } } = {};

    sales.forEach(sale => {
      const date = sale.date.split('T')[0];
      if (!summary[date]) {
        summary[date] = { total: 0, count: 0 };
      }
      summary[date].total += sale.finalTotal;
      summary[date].count += 1;
    });

    return Object.entries(summary).map(([date, data]) => ({
      date,
      total: data.total,
      count: data.count
    }));
  }

  /**
   * Generates a summary of purchases by date.
   */
  static getPurchasesSummary(purchases: Purchase[]): { date: string, total: number, count: number }[] {
    const summary: { [date: string]: { total: number, count: number } } = {};

    purchases.forEach(purchase => {
      const date = purchase.date.split('T')[0];
      if (!summary[date]) {
        summary[date] = { total: 0, count: 0 };
      }
      summary[date].total += purchase.totalAmount;
      summary[date].count += 1;
    });

    return Object.entries(summary).map(([date, data]) => ({
      date,
      total: data.total,
      count: data.count
    }));
  }

  /**
   * Calculates the total value of stock.
   */
  static calculateStockValue(products: Product[]): number {
    return products.reduce((acc, p) => acc + (p.StockQuantity * (p.CostPrice || 0)), 0);
  }

  /**
   * Generates a report of item profits.
   */
  static generateItemProfits(sales: Sale[]): ItemProfitEntry[] {
    const profits: { [productId: string]: ItemProfitEntry } = {};

    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!profits[item.product_id]) {
          profits[item.product_id] = {
            id: `PROF-ITEM-${item.product_id}`,
            productId: item.product_id,
            itemName: item.name,
            period: { start: new Date().toISOString(), end: new Date().toISOString() },
            totalSales: 0,
            totalCost: 0,
            grossProfit: 0,
            profitMargin: 0,
            unitsSold: 0
          };
        }
        const p = profits[item.product_id];
        p.unitsSold += item.qty;
        p.totalSales += item.qty * item.price;
        // Assuming we have cost price somewhere, but for now using a placeholder or 0
        const costPrice = 0; 
        p.totalCost += item.qty * costPrice;
        p.grossProfit = p.totalSales - p.totalCost;
        p.profitMargin = p.totalSales > 0 ? (p.grossProfit / p.totalSales) * 100 : 0;
      });
    });

    return Object.values(profits);
  }
}
