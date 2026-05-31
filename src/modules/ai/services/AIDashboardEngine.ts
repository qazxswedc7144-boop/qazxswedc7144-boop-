import { GeminiAnalyticsService } from './GeminiAnalyticsService';
import { DashboardAggregationService } from '@/services/dashboard/DashboardAggregationService';

export interface DashboardMetrics {
  totalSales: number;
  totalPurchases: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  expenses: number;
  topSellingItems: any[];
  mostProfitableItems: any[];
  slowMovingItems: any[];
  lowStockAlerts: any[];
  expiryAlerts: any[];
  anomalies: any[];
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  todaySummary: {
    sales: number;
    profit: number;
    expenses: number;
  };
  recommendations?: string;
  lastUpdated: string;
}

export class AIDashboardEngine {
  private static AI_CACHE_KEY = 'pharmaflow_dashboard_ai_cache';
  private static AI_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for dashboard AI

  static async getMetrics(forceRefresh = false): Promise<DashboardMetrics> {
    // Always calculate fresh DB metrics
    const metrics = await this.calculateMetrics(forceRefresh);
    return metrics;
  }

  private static async calculateMetrics(forceRefreshAI = false): Promise<DashboardMetrics> {
    const metrics = await DashboardAggregationService.getFullDashboardMetrics(forceRefreshAI);

    // 9) Optional Gemini Summary
    let recommendations = '';
    const now = Date.now();
    const cachedAIStr = localStorage.getItem(this.AI_CACHE_KEY);
    let cachedAI = null;
    
    if (cachedAIStr) {
      try {
        cachedAI = JSON.parse(cachedAIStr);
      } catch (e) {}
    }
    
    if (!forceRefreshAI && cachedAI && (now - cachedAI.timestamp < this.AI_CACHE_DURATION)) {
      recommendations = cachedAI.recommendations;
    } else {
      try {
        const summaryData = {
          totalSales: metrics.totalSales,
          totalPurchases: metrics.totalPurchases,
          netProfit: metrics.netProfit,
          expenses: metrics.expenses,
          alertsCount: metrics.lowStockAlerts.length + metrics.expiryAlerts.length + metrics.anomalies.length,
          riskScore: metrics.riskScore,
          todaySummary: metrics.todaySummary
        };
        recommendations = await GeminiAnalyticsService.analyzeData("قدم ملخصاً ذكياً وتوصيات بناءً على هذه المؤشرات المالية والتشغيلية للمؤسسة اليوم.", summaryData);
        localStorage.setItem(this.AI_CACHE_KEY, JSON.stringify({ recommendations, timestamp: now }));
      } catch (e) {
        console.error("Gemini summary failed:", e);
        recommendations = cachedAI?.recommendations || "تعذر الحصول على ملخص ذكي حالياً.";
      }
    }

    return {
      ...metrics,
      recommendations
    };
  }
}
