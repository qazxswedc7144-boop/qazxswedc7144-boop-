import { ReportEngine } from '../core/engines/reportEngine';

export class GeminiAnalyticsService {
  private static CACHE_PREFIX = 'pharmaflow_gemini_cache_';
  private static CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private static LAST_REQUEST_TIME = 0;
  private static MIN_REQUEST_INTERVAL = 5000; // 5 seconds between requests

  private static async generateHash(str: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static async analyzeData(prompt: string, data: any) {
    const dataStr = JSON.stringify(data);
    const cacheKey = await this.generateHash(prompt + dataStr);
    
    // 1. Check Cache
    const cached = localStorage.getItem(this.CACHE_PREFIX + cacheKey);
    if (cached) {
      const { result, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < this.CACHE_TTL) {
        return result;
      }
    }

    // 2. Rate Limiting (Cooldown)
    const now = Date.now();
    if (now - this.LAST_REQUEST_TIME < this.MIN_REQUEST_INTERVAL) {
      if (cached) return JSON.parse(cached).result;
      return "يرجى الانتظار قليلاً قبل طلب تحليل جديد.";
    }

    try {
      this.LAST_REQUEST_TIME = now;
      
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${prompt}\n\nData: ${dataStr}` })
      });

      if (!response.ok) {
        throw new Error('فشل الاتصال بخدمة الذكاء الاصطناعي');
      }

      const responseData = await response.json();
      const result = responseData.text || "لم يتم استلام أي استجابة من الذكاء الاصطناعي.";
      
      // 3. Save to Cache
      localStorage.setItem(this.CACHE_PREFIX + cacheKey, JSON.stringify({
        result,
        timestamp: Date.now()
      }));

      return result;
    } catch (error: any) {
      console.error("Analytics Error:", error);
      return "حدث خطأ أثناء إجراء التحليل. يرجى المحاولة لاحقاً.";
    }
  }

  static async predictSales(historicalData: any) {
    return this.analyzeData("توقع اتجاه المبيعات للفترة القادمة واقترح كميات الطلب المثالية.", historicalData);
  }

  static async analyze(summary: any) {
    return this.analyzeData("قم بتحليل ملخص البيانات التالي وتقديم رؤى سريعة وتوصيات.", summary);
  }

  static async detectAnomalies(transactions: any) {
    return this.analyzeData("ابحث عن أي تناقضات أو عمليات مشبوهة في حركة الحسابات أو المخزون.", transactions);
  }

  static async getTopSellingInsights(data: any) {
    return this.analyzeData("حلل الأصناف الأكثر مبيعاً واقترح استراتيجيات لزيادة الربح منها.", data);
  }

  static async getBestCustomerInsights(data: any) {
    return this.analyzeData("حلل أفضل العملاء واقترح برامج ولاء أو عروض مخصصة لهم.", data);
  }

  static async getHighestProfitInsights(data: any) {
    return this.analyzeData("حلل الأصناف ذات أعلى هامش ربح واقترح كيفية تحسين مبيعاتها.", data);
  }

  static async getEnterpriseInsights() {
    const summary = await ReportEngine.getAnalyticsSummary();
    const incomeStatement = await ReportEngine.getIncomeStatement();
    const data = { summary, incomeStatement };
    return this.analyzeData("قم بتقديم تحليل شامل لأداء المؤسسة المالي والتشغيلي، موضحاً نقاط القوة والضعف وفرص النمو.", data);
  }
}
