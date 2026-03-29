
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
      summary[date].total += purchase.finalTotal;
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
        if (!profits[item.ProductID]) {
          profits[item.ProductID] = {
            id: `PROF-ITEM-${item.ProductID}`,
            date: new Date().toISOString(),
            productId: item.ProductID,
            itemName: item.Name,
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            margin: 0
          };
        }
        const p = profits[item.ProductID];
        p.quantity += item.Quantity;
        p.revenue += item.Quantity * item.UnitPrice;
        p.cost += item.Quantity * (item.CostPrice || 0);
        p.profit = p.revenue - p.cost;
        p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
      });
    });

    return Object.values(profits);
  }
}
