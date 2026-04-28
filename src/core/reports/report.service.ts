// src/core/reports/report.service.ts

import { SaleRecord } from "../sales/sales.service";

export type SalesSummary = {
  totalSales: number;
  totalAmount: number;
  averageTransactionValue: number;
  countByPaymentMethod: {
    cash: number;
    card: number;
    credit: number;
  };
};

/**
 * Report Service
 * Aggregates data for business insights.
 */
export const reportService = {
  /**
   * Generates a summary from a list of sales records
   */
  generateSalesSummary(sales: SaleRecord[]): SalesSummary {
    const summary: SalesSummary = {
      totalSales: sales.length,
      totalAmount: 0,
      averageTransactionValue: 0,
      countByPaymentMethod: {
        cash: 0,
        card: 0,
        credit: 0
      }
    };

    if (sales.length === 0) return summary;

    sales.forEach(sale => {
      summary.totalAmount += sale.totalAmount;
      summary.countByPaymentMethod[sale.paymentMethod]++;
    });

    summary.averageTransactionValue = summary.totalAmount / summary.totalSales;

    return summary;
  }
};
